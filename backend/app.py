from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
from collections import defaultdict
import json
import dotenv
import os
import base64
import requests
from datetime import datetime, timedelta
import uuid
from pymongo import MongoClient

dotenv.load_dotenv()

app = Flask(__name__)
CORS(app)

db = MongoClient(os.getenv("MONGO_URI"))["spotiswipe"]
collection = db["users_data"]

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

# Global variables for token management
global_access_token = None
token_expiry = None

def get_access_token():
    """Get a new Spotify access token"""
    global global_access_token, token_expiry
    
    # Check if current token is still valid
    if global_access_token and token_expiry and datetime.now() < token_expiry:
        return global_access_token
    
    try:
        # Encode client credentials
        auth_string = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        auth_b64 = base64.b64encode(auth_string.encode()).decode()
        
        # Request new token
        response = requests.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={"grant_type": "client_credentials"}
        )
        
        response.raise_for_status()
        token_data = response.json()
        
        # Update global token and expiry
        global_access_token = token_data.get("access_token")
        token_expiry = datetime.now() + timedelta(seconds=token_data.get("expires_in", 3600) - 300)  # Buffer of 5 minutes
        
        return global_access_token
    
    except Exception as e:
        return None

def refresh_token_if_needed():
    """Check and refresh token if needed"""
    global token_expiry
    
    if not global_access_token or not token_expiry or datetime.now() >= token_expiry:
        return get_access_token()
    return global_access_token


class MusicRecommender:
    def __init__(self, data):
        """Initialize the recommender with cleaned data"""
        self.data = data
        self.data['genre_list'] = self.data['track_genre'].str.split(',').apply(lambda x: [g.strip() for g in x])
        self.unique_genres = set()
        for genres in self.data['genre_list']:
            self.unique_genres.update(genres)
            
        self.feature_columns = [
            'danceability', 'energy', 'loudness', 'speechiness',
            'acousticness', 'instrumentalness', 'liveness', 
            'valence', 'tempo'
        ]
        self.index_mapping = {idx: i for i, idx in enumerate(self.data.index)}
        self.data_normalized = self._normalize_features()

    def _normalize_features(self):
        """Normalize all numerical features to 0-1 range"""
        normalized_data = self.data.copy()
        for column in self.feature_columns:
            if column == 'loudness':  # Special handling for loudness due to negative values
                max_abs = max(abs(self.data[column].min()), abs(self.data[column].max()))
                normalized_data[column] = (self.data[column] + max_abs) / (2 * max_abs)
            else:
                min_val = self.data[column].min()
                max_val = self.data[column].max()
                if max_val - min_val > 0:
                    normalized_data[column] = (self.data[column] - min_val) / (max_val - min_val)
                else:
                    normalized_data[column] = 0
        return normalized_data

    def generate_recommendations(self, liked_songs_indices, n_recommendations=50):
        """Generate recommendations based on liked songs"""
        try:
            if not liked_songs_indices:
                return []
            
            liked_indices = []
            for track_id in liked_songs_indices:
                try:
                    song_idx = self.data[self.data['track_id'] == track_id].index[0]
                    liked_indices.append(song_idx)
                except (IndexError, KeyError):
                    continue
            
            if not liked_indices:
                return []
            
            liked_features = self.data_normalized.loc[liked_indices][self.feature_columns].mean()
            
            similarities = []
            for idx in self.data_normalized.index:
                if idx not in liked_indices:
                    similarity = 1 / (1 + np.linalg.norm(
                        self.data_normalized.loc[idx][self.feature_columns] - liked_features
                    ))
                    similarities.append((idx, similarity))
            
            similarities.sort(key=lambda x: x[1], reverse=True)
            recommended_indices = [idx for idx, _ in similarities[:n_recommendations]]
            
            recommendations = self.data.loc[recommended_indices].to_dict('records')
            
            for rec in recommendations:
                rec['index'] = rec['track_id']
                rec['track_genre'] = ', '.join(rec['genre_list'])
                del rec['genre_list']
            
            return recommendations
            
        except Exception as e:

            return []

    def get_initial_songs(self, selected_genres, n_songs=10):
        """Get initial songs that match any of the selected genres"""
        try:
            genre_songs = self.data[self.data['genre_list'].apply(
                lambda x: any(genre in x for genre in selected_genres)
            )]
            
            if genre_songs.empty:
                return []
                
            genre_songs = genre_songs.sort_values('popularity', ascending=False)
            songs_per_genre = max(1, n_songs // len(selected_genres))
            initial_songs = []
            
            for genre in selected_genres:
                genre_specific = genre_songs[genre_songs['genre_list'].apply(lambda x: genre in x)]
                available_songs = min(len(genre_specific), songs_per_genre)
                initial_songs.extend(genre_specific.head(available_songs).to_dict('records'))
            
            np.random.shuffle(initial_songs)
            
            for song in initial_songs:
                song['track_genre'] = ', '.join(song['genre_list'])
                del song['genre_list']
            
            return initial_songs[:n_songs]

        except Exception as e:
            return []
        
    def get_song_data(self,track_id):
        return self.data[self.data['track_id'] == track_id].to_dict('records')[0]


# Update data loading and cleaning
try:
    df = pd.read_csv('spotify_tracks_data.csv')
    
    # Clean the data
    df = df.dropna()
    df = df.drop_duplicates(subset='track_id')
    
    # drop row with "Unknown" genre
    df = df[df['track_genre'] != 'Unknown']
    
    # Split genres into lists
    df['track_genre'] = df['track_genre'].str.strip()
    
    # Ensure all required columns exist and have valid data
    required_columns = [
        'track_id', 'track_name', 'artists', 'track_genre',
        'popularity', 'danceability', 'energy', 'loudness',
        'speechiness', 'acousticness', 'instrumentalness',
        'liveness', 'valence', 'tempo'
    ]
    
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")
    
    # Convert numerical columns to appropriate types
    numerical_columns = [
        'popularity', 'danceability', 'energy', 'loudness',
        'speechiness', 'acousticness', 'instrumentalness',
        'liveness', 'valence', 'tempo'
    ]
    
    for col in numerical_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Drop any rows with invalid numerical values
    df = df.dropna()
    
    recommender = MusicRecommender(df)
    
except Exception as e:
    print(f"Error loading data: {e}")
    
# Cache for storing user sessions
user_sessions = {}


@app.route('/api/genres', methods=['GET'])
def get_genres():
    """Get list of unique genres"""
    return jsonify({'genres': list(recommender.unique_genres)})


@app.route('/api/user-login', methods=['POST'])
def user_login():
    """Create a new user session"""
    try:

        data = request.get_json()

        if not data.get('name'):
            return jsonify({'error': 'Name is required'}), 400
        # Create session for user
        session_id = str(uuid.uuid4)
        user_sessions[session_id] = {
            'name': data['name'],
            'genres': [],
            'liked_songs': []
        }

        collection.insert_one({
            "session_id": session_id,
            "name": data['name'],
            "email": data['email'],
            "preference": [],
            "timestamp": datetime.now(),
        })

        return jsonify({'session_id': session_id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# Update the route in Flask app
@app.route('/api/initial-songs', methods=['POST'])
def get_initial_songs():
    """Get initial songs based on selected genres"""
    try:
        data = request.get_json()
        selected_genres = data.get('genres', [])

        session_id = data.get('session_id')
        if not session_id or session_id not in user_sessions:
            return jsonify({'error': 'Invalid session'}), 400
        
        if not selected_genres:
            return jsonify({'error': 'No genres selected'}), 400
        
        initial_songs = recommender.get_initial_songs(selected_genres)
        
        if not initial_songs:
            return jsonify({'error': 'No songs found for selected genres'}), 404
        
        
        user_sessions[session_id]['genres'] = selected_genres

        collection.update_one({"session_id": session_id}, {"$set": {"genres": selected_genres}})
        
        return jsonify({
            'session_id': session_id,
            'songs': initial_songs,
            'total_songs': len(initial_songs)  # Add this to inform frontend
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/swipe', methods=['POST'])
def handle_swipe():
    """Handle user's swipe action"""
    try:
        
        data = request.get_json()
        session_id = data.get('session_id')
        song_index = data.get('song_index')
        liked = data.get('liked', False)
        
        if not session_id or session_id not in user_sessions:
            return jsonify({'error': 'Invalid session'}), 400
        

        if liked and song_index is not None:
            user_sessions[session_id]['liked_songs'].append(song_index)
        

        song_data = {
            "track_id": song_index,
            "song_name": recommender.get_song_data(song_index)['track_name'],
            "liked": liked,
        }

        collection.update_one({"session_id": session_id}, {"$push": {"preference": song_data}})
        

        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get final recommendations based on liked songs"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id or session_id not in user_sessions:
            return jsonify({'error': 'Invalid session'}), 400

        
        liked_songs = user_sessions[session_id]['liked_songs']
        recommendations = recommender.generate_recommendations(liked_songs)
        collection.update_one({"session_id": session_id}, {"$set": {"recommendations": recommendations}})
        
        # Clean up session
        del user_sessions[session_id]
        return jsonify({'recommendations': recommendations})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route("/get-song-detail", methods=["POST"])
def get_song_detail():
    """Get song thumbnail from Spotify API"""
    try:
        data = request.get_json()
        track_id = data.get("track_id")
        
        if not track_id:
            return jsonify({"error": "No track_id provided"}), 400
        
        # Get fresh token
        access_token = refresh_token_if_needed()
        if not access_token:
            return jsonify({"error": "Failed to get Spotify access token"}), 500
        
        # Make request to Spotify API
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers=headers
        )
        
        # Handle rate limiting
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 1))
            return jsonify({
                "error": "Rate limited by Spotify",
                "retry_after": retry_after
            }), 429
        
        response.raise_for_status()
        track_data = response.json()
        
        # Extract thumbnail data
        thumbline = {
            "name": track_data.get("name"),
            "artists": ", ".join([artist["name"] for artist in track_data.get("artists", [])]),
            "album": track_data.get("album", {}).get("name"),
            "image": next(
                (image["url"] for image in track_data.get("album", {}).get("images", [])
                 if image.get("height", 0) >= 300),  # Prefer larger images
                track_data.get("album", {}).get("images", [{}])[0].get("url")  # Fallback to first image
            ),
            "preview_url": track_data.get("preview_url")
        }
        
        return jsonify(thumbline)
    
    except requests.exceptions.RequestException as e:
        # Handle network or API errors
        error_message = str(e)
        if hasattr(e.response, 'json'):
            try:
                error_message = e.response.json().get('error', {}).get('message', str(e))
            except:
                pass
        return jsonify({"error": f"Spotify API error: {error_message}"}), 502
    
    except Exception as e:
        # Handle all other errors
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

    
if __name__ == '__main__':
    app.run(debug=True)
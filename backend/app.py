from flask import Flask, jsonify, request, render_template
from flask_cors import CORS, cross_origin
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

CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
        "expose_headers": ["Content-Range", "X-Content-Range"],
        "supports_credentials": True,
        "max_age": 600,
        "send_wildcard": False
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# MongoDB setup
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
        self.data_normalized = self._normalize_features()
        
        # Co-occurrence matrix for collaborative filtering
        self.co_occurrence_matrix = {}
    
    def _normalize_features(self):
        """Normalize all numerical features to 0-1 range"""
        normalized_data = self.data.copy()
        for column in self.feature_columns:
            if column == 'loudness':
                max_abs = max(abs(min(self.data[column])), abs(max(self.data[column])))
                normalized_data[column] = self.data[column].apply(lambda x: (x + max_abs) / (2 * max_abs))
            else:
                min_val = min(self.data[column])
                max_val = max(self.data[column])
                if max_val - min_val > 0:
                    normalized_data[column] = self.data[column].apply(lambda x: (x - min_val) / (max_val - min_val))
                else:
                    normalized_data[column] = self.data[column].apply(lambda x: 0)
        return normalized_data

    def _calculate_average_features(self, indices):
        """Calculate average features for a list of song indices"""
        if not indices:
            return {col: 0 for col in self.feature_columns}
        
        sums = {col: 0 for col in self.feature_columns}
        count = len(indices)
        
        for idx in indices:
            for col in self.feature_columns:
                sums[col] += self.data_normalized.loc[idx][col]
        
        return {col: sums[col] / count for col in self.feature_columns}
    
    def _calculate_cosine_similarity(self, features1, features2):
        """Calculate Cosine similarity between two feature vectors"""
        dot_product = sum(f1 * f2 for f1, f2 in zip(features1, features2))
        magnitude1 = sum(f1 ** 2 for f1 in features1) ** 0.5
        magnitude2 = sum(f2 ** 2 for f2 in features2) ** 0.5
        if magnitude1 * magnitude2 == 0:
            return 0
        return dot_product / (magnitude1 * magnitude2)

    def _update_co_occurrence_matrix(self, liked_songs_indices):
        """Update co-occurrence matrix based on liked songs"""
        for i, song1 in enumerate(liked_songs_indices):
            if song1 not in self.co_occurrence_matrix:
                self.co_occurrence_matrix[song1] = {}
            for j, song2 in enumerate(liked_songs_indices):
                if i != j:
                    if song2 not in self.co_occurrence_matrix[song1]:
                        self.co_occurrence_matrix[song1][song2] = 0
                    self.co_occurrence_matrix[song1][song2] += 1

    def generate_recommendations(self, liked_songs_indices, n_recommendations=25, use_cosine_similarity=True):
        """Generate recommendations based on liked songs using hybrid recommendation approach"""
        try:
            if not liked_songs_indices:
                return []
            
            # Update the co-occurrence matrix
            self._update_co_occurrence_matrix(liked_songs_indices)
            
            # Convert track_ids to dataframe indices
            liked_indices = []
            for track_id in liked_songs_indices:
                try:
                    song_idx = self.data[self.data['track_id'] == track_id].index[0]
                    liked_indices.append(song_idx)
                except (IndexError, KeyError):
                    continue
            
            if not liked_indices:
                return []
            
            # Calculate average features of liked songs
            avg_features = self._calculate_average_features(liked_indices)
            
            # Calculate similarities for all songs
            similarities = []
            for idx in self.data_normalized.index:
                if idx not in liked_indices:
                    current_features = [self.data_normalized.loc[idx][col] for col in self.feature_columns]
                    avg_features_list = [avg_features[col] for col in self.feature_columns]
                    
                    if use_cosine_similarity:
                        similarity = self._calculate_cosine_similarity(current_features, avg_features_list)
                    else:
                        distance = self._calculate_euclidean_distance(current_features, avg_features_list)
                        similarity = 1 / (1 + distance)
                    
                    similarities.append((idx, similarity))
            
            # Sort by similarity and get top recommendations
            similarities.sort(key=lambda x: x[1], reverse=True)
            recommended_indices = [idx for idx, _ in similarities[:n_recommendations]]
            
            # Include collaborative recommendations from co-occurrence matrix
            for liked_idx in liked_indices:
                if liked_idx in self.co_occurrence_matrix:
                    for co_idx, freq in sorted(self.co_occurrence_matrix[liked_idx].items(), key=lambda x: x[1], reverse=True):
                        if co_idx not in recommended_indices and len(recommended_indices) < n_recommendations:
                            recommended_indices.append(co_idx)
            
            recommendations = self.data.loc[recommended_indices].to_dict('records')
            
            for rec in recommendations:
                rec['index'] = rec['track_id']
                rec['track_genre'] = ', '.join(rec['genre_list'])
                del rec['genre_list']
            
            return recommendations
            
        except Exception as e:
            print(f"Error in generate_recommendations: {e}")
            return []

    def get_initial_songs(self, selected_genres, n_songs=20):
        """Get initial songs that match any of the selected genres with random shuffling"""
        try:
            # Filter songs by selected genres
            genre_songs = []
            for idx, row in self.data.iterrows():
                if any(genre in row['genre_list'] for genre in selected_genres):
                    song_dict = row.to_dict()
                    song_dict['index'] = song_dict['track_id']
                    song_dict['track_genre'] = ', '.join(song_dict['genre_list'])
                    del song_dict['genre_list']
                    genre_songs.append((song_dict, song_dict['popularity']))
            
            if not genre_songs:
                return []
            
            # Shuffle all genre songs
            import random
            random.shuffle(genre_songs)
            
            # Trim to the top n_songs
            selected_songs = [song[0] for song in genre_songs[:n_songs]]
            
            return selected_songs

        except Exception as e:
            print(f"Error in get_initial_songs: {e}")
            return []

        
    def get_song_data(self, track_id):
        """Get song data by track_id"""
        try:
            song = self.data[self.data['track_id'] == track_id].iloc[0].to_dict()
            song['track_genre'] = ', '.join(song['genre_list'])
            del song['genre_list']
            return song
        except:
            return None

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

        # Generate a proper session ID
        session_id = str(uuid.uuid4())
        
        # Create user document in MongoDB
        user_data = {
            "session_id": session_id,
            "name": data.get('name'),
            "email": data.get('email'),
            "preferences": [],  # Initialize empty preferences array
            "genres": [],      # Initialize empty genres array
            "created_at": datetime.now(),
            "last_updated": datetime.now()
        }
        
        # Insert into MongoDB
        collection.insert_one(user_data)

        # Create session in memory
        user_sessions[session_id] = {
            'name': data['name'],
            'genres': [],
            'liked_songs': []
        }

        return jsonify({
            'session_id': session_id,
            'status': 'success',
            'message': 'User session created successfully'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/initial-songs', methods=['POST'])
def get_initial_songs():
    """Get initial songs based on selected genres"""
    try:
        data = request.get_json()
        selected_genres = data.get('genres', [])
        session_id = data.get('session_id')

        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400

        # Check if user exists in database
        user = collection.find_one({"session_id": session_id})
        if not user:
            return jsonify({'error': 'Invalid session'}), 400
        
        if not selected_genres:
            return jsonify({'error': 'No genres selected'}), 400
        
        initial_songs = recommender.get_initial_songs(selected_genres)
        
        if not initial_songs:
            return jsonify({'error': 'No songs found for selected genres'}), 404
        
        # Update both memory session and database
        user_sessions[session_id]['genres'] = selected_genres

        # Update MongoDB with genres and timestamp
        collection.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "genres": selected_genres,
                    "last_updated": datetime.now()
                }
            }
        )
        
        return jsonify({
            'session_id': session_id,
            'songs': initial_songs,
            'total_songs': len(initial_songs)
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
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400

        # Check if user exists in database
        user = collection.find_one({"session_id": session_id})
        if not user:
            return jsonify({'error': 'Invalid session'}), 400

        # Get song data
        song_data = recommender.get_song_data(song_index)
        if not song_data:
            return jsonify({'error': 'Invalid song index'}), 400

        # Create preference object
        preference = {
            "track_id": song_index,
            "song_name": song_data['track_name'],
            "artists": song_data['artists'],
            "liked": liked,
            "swiped_at": datetime.now()
        }

        # Update memory session
        if liked and song_index is not None:
            user_sessions[session_id]['liked_songs'].append(song_index)

        # Update MongoDB - add new preference and update timestamp
        collection.update_one(
            {"session_id": session_id},
            {
                "$push": {"preferences": preference},
                "$set": {"last_updated": datetime.now()}
            }
        )

        return jsonify({
            'status': 'success',
            'message': 'Preference recorded successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get final recommendations based on liked songs"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400

        # Check if user exists in database
        user = collection.find_one({"session_id": session_id})
        if not user:
            return jsonify({'error': 'Invalid session'}), 400

        liked_songs = user_sessions.get(session_id, {}).get('liked_songs', [])
        recommendations = recommender.generate_recommendations(liked_songs)

        # Update MongoDB with recommendations and final timestamp
        collection.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "recommendations": recommendations,
                    "completed_at": datetime.now(),
                    "last_updated": datetime.now()
                }
            }
        )
        
        # Clean up memory session
        if session_id in user_sessions:
            del user_sessions[session_id]

        return jsonify({
            'status': 'success',
            'recommendations': recommendations
        })

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
    app.run(debug=True,  host="0.0.0.0")
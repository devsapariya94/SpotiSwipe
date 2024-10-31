import requests
import pandas as pd
from typing import List, Dict
import time
from requests.auth import HTTPBasicAuth
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import dotenv

dotenv.load_dotenv()

global counter
counter = 0

class SpotifyDataCollector:
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = self.get_token()
        self.genre_cache = {}  # Cache for storing artist genres

    def get_token(self) -> str:
        """Authenticate with Spotify API to get an access token."""
        auth_url = "https://accounts.spotify.com/api/token"
        response = requests.post(auth_url, data={"grant_type": "client_credentials"},
                                 auth=HTTPBasicAuth(self.client_id, self.client_secret))
        response_data = response.json()
        return response_data["access_token"]

    def get_headers(self) -> Dict[str, str]:
        """Return headers for Spotify API requests."""
        return {
            "Authorization": f"Bearer {self.token}"
        }

    def fetch_artist_genre(self, artist_id: str) -> List[str]:
        """Fetch genres for a specific artist by artist_id, using cache if available."""
        if artist_id in self.genre_cache:
            return self.genre_cache[artist_id]

        artist_url = f"https://api.spotify.com/v1/artists/{artist_id}"
        response = requests.get(artist_url, headers=self.get_headers())
        genres = response.json().get("genres", []) if response.status_code == 200 else []
        
        self.genre_cache[artist_id] = genres  # Cache the fetched genres
        return genres

    def get_track_genres(self, track: Dict) -> str:
        """Aggregate genres from all artists in a track using concurrency and caching."""
        all_genres = set()
        
        with ThreadPoolExecutor() as executor:
            futures = {executor.submit(self.fetch_artist_genre, artist["id"]): artist for artist in track["artists"]}
            for future in as_completed(futures):
                genres = future.result()
                all_genres.update(genres)  # Use a set to keep genres unique

        return ", ".join(all_genres) if all_genres else "Unknown"  # Join unique genres or return 'Unknown'

    def get_track_data(self, track_ids: List[str]) -> pd.DataFrame:
        """Fetch track data and audio features for a list of track IDs."""
        global counter
        all_track_data = []

        for i in range(0, len(track_ids), 50):
            batch = track_ids[i:i+50]
            tracks_url = f"https://api.spotify.com/v1/tracks?ids={','.join(batch)}"
            features_url = f"https://api.spotify.com/v1/audio-features?ids={','.join(batch)}"
            
            track_response = requests.get(tracks_url, headers=self.get_headers())
            features_response = requests.get(features_url, headers=self.get_headers())

            if track_response.status_code == 200 and features_response.status_code == 200:
                tracks = track_response.json()["tracks"]
                features = features_response.json()["audio_features"]

                for track, feature in zip(tracks, features):
                    if track and feature:
                        track_data = {
                            "track_id": track["id"],
                            "artists": ", ".join([artist["name"] for artist in track["artists"]]),
                            "album_name": track["album"]["name"],
                            "track_name": track["name"],
                            "popularity": track["popularity"],
                            "duration_ms": track["duration_ms"],
                            "explicit": track["explicit"],
                            "danceability": feature["danceability"],
                            "energy": feature["energy"],
                            "key": feature["key"],
                            "loudness": feature["loudness"],
                            "mode": feature["mode"],
                            "speechiness": feature["speechiness"],
                            "acousticness": feature["acousticness"],
                            "instrumentalness": feature["instrumentalness"],
                            "liveness": feature["liveness"],
                            "valence": feature["valence"],
                            "tempo": feature["tempo"],
                            "time_signature": feature["time_signature"],
                            "track_genre": self.get_track_genres(track)
                        }

                        print(f"Processed track {track['name']}; Genre: {track_data['track_genre']}")
                        all_track_data.append(track_data)
                        counter += 1

                        if counter % 50 == 0:
                            # Save intermediate data
                            print(f"Saving intermediate file with {counter} entries.")
                            pd.DataFrame(all_track_data).to_csv(f'spotify_tracks_data_intermediate_{counter}.csv', index=False)

            # time.sleep(1)  # Adjust as needed to avoid rate limits

        return pd.DataFrame(all_track_data)

def main():
    CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID")
    CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET")
    
    track_ids = pd.read_csv("track_ids.csv")["track_id"].tolist()
    collector = SpotifyDataCollector(CLIENT_ID, CLIENT_SECRET)
    df = collector.get_track_data(track_ids)
    
    # Define data types for output DataFrame
    dtype_dict = {
        "track_id": "str",
        "artists": "str",
        "album_name": "str",
        "track_name": "str",
        "popularity": "int64",
        "duration_ms": "int64",
        "explicit": "bool",
        "danceability": "float64",
        "energy": "float64",
        "key": "int64",
        "loudness": "float64",
        "mode": "int64",
        "speechiness": "float64",
        "acousticness": "float64",
        "instrumentalness": "float64",
        "liveness": "float64",
        "valence": "float64",
        "tempo": "float64",
        "time_signature": "int64",
        "track_genre": "str"
    }
    
    df = df.astype(dtype_dict)
    df.to_csv("spotify_tracks_data.csv", index=False)

if __name__ == "__main__":
    main()

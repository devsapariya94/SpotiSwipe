import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import pandas as pd
from typing import List
import os
import dotenv

dotenv.load_dotenv()

class SpotifyPlaylistExtractor:
    def __init__(self, client_id: str, client_secret: str):
        """Initialize Spotify client with credentials"""
        auth_manager = SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret
        )
        self.sp = spotipy.Spotify(auth_manager=auth_manager)
    
    def get_playlist_tracks(self, playlist_id: str) -> List[str]:
        """Extract all track IDs from a playlist"""
        tracks = []
        results = self.sp.playlist_tracks(playlist_id)
        
        while results:
            for item in results['items']:
                if item['track'] is not None:
                    tracks.append(item['track']['id'])
            
            results = self.sp.next(results) if results['next'] else None
            
        return tracks

def main():
    # Replace with your Spotify API credentials
    CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
    
    # Initialize extractor
    extractor = SpotifyPlaylistExtractor(CLIENT_ID, CLIENT_SECRET)
    
    # Example playlist ID (replace with your playlist ID)
    PLAYLIST_IDS = ["0i2S0eEdftTrmLKueMWUKX", "37i9dQZF1DX0XUfTFmNBRM","2U5naKBJ5DN3oOPbuRiTem", "37i9dQZEVXbLZ52XmnySJg","4nNVfQ9eWidZXkBKZN5li4","4y2MWq5CaEtCIiU5vngwIl","37i9dQZF1DWXtlo6ENS92N","7sTkp2X5Aq84v9w9UtfkaF","37i9dQZF1DWZNJXX2UeBij", "37i9dQZF1DWYRTlrhMB12D", "4vBo2bq0dohHJSswn5pNGC", "6an0hNyshVMWORG7qVNUbq", "5gSVvj8ukLSQlSnClSp1sR", "5ac6PsFtcjz6feEUD7Hqff", "6Y5PXLpvP5sY2hRcIQJoMP", "72Ehl5vaajx3jB7IiY2dun", "7rkHa0nMODlV8YSxgptPB6", "3zGW3iZLZYWa8d3DOxRplp"]
    
    # Extract track IDs from playlist
    track_ids = set()
    for playlist_id in PLAYLIST_IDS:
        try:
            track_ids.update(extractor.get_playlist_tracks(playlist_id))
        except:
            print(f"Failed to extract tracks from playlist {playlist_id}")

    # Save track IDs to CSV
    df = pd.DataFrame(track_ids, columns=["track_id"])
    df.to_csv("track_ids.csv", index=False)

    
if __name__ == "__main__":
    main()
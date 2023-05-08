---
layout: post
title: Spotify Playlist Generator
---
This is a program where I experimented with and learned about APIs. The program uses Spotify's developer tools. Unique to my app, I have a client ID and client secret, given to me by spotify and stored in another file in the same environment for security. I take these two, send a request to Spotify asking for a login url, and display that url to the user. The user logs in, collects a unique authorization code (valid for 10 minutes), and inputs that to the program. With the authorization code, I can get an access token (also only valid temporarily), with which I can collect data and perform actions on the user's account (they agree to all of this when they log in). Once it has access, my program will prompt the user for the title, description, and desired length for their playlist. Then, it will randomly select 5 over the user's saved songs and 5 of their top songs over the past 4 weeks, and use them as seeding songs for Spotify's recommendation algorithm. It then takes the specified number of recommended songs and creates a new playlist with them.


{% highlight python %}
from dotenv import load_dotenv
import os
import base64
from urllib.parse import urlencode
from requests import post, get
import json
import random


load_dotenv()
client_id = os.getenv("CLIENT_ID")
client_secret = os.getenv("CLIENT_SECRET")
redirect_uri = os.getenv("REDIRECT_URI")

def get_auth_url():
    url = "https://accounts.spotify.com/authorize"
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "user-read-private user-read-email user-library-read user-library-modify user-read-recently-played user-top-read playlist-read-private playlist-modify-private"
    }
    auth_url = url + "?" + urlencode(params)
    return auth_url

def get_auth_header(token):
    return {"Authorization": "Bearer " + token}

def get_token(code=None, refresh_token=None):
    auth_string = client_id + ":" + client_secret
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = str(base64.b64encode(auth_bytes), "utf-8")
    
    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization": "Basic " + auth_base64,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    if code:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri
        }
    else:
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
    result = post(url, headers=headers, data=data)
    json_result = json.loads(result.content)
    access_token = json_result["access_token"]
    refresh_token = json_result.get("refresh_token", refresh_token)
    return access_token, refresh_token

def get_user_data(access_token):
    url= "https://api.spotify.com/v1/me"
    headers = get_auth_header(access_token)
    result = get(url, headers=headers)
    json_result = json.loads(result.content)
    return json_result

def get_saved_songs(access_token):
    url = "https://api.spotify.com/v1/me/tracks?limit=50"
    headers = get_auth_header(access_token)
    result = get(url, headers=headers)
    json_result = json.loads(result.content)
    track_ids = [track["track"]["id"] for track in json_result["items"]]
    return track_ids

def get_top_tracks(access_token):
    url = "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50"
    headers = get_auth_header(access_token)
    result = get(url, headers=headers)
    json_result = json.loads(result.content)
    track_ids = [track["id"] for track in json_result["items"]]
    return track_ids

def get_recommendations(track_ids,access_token,size=20):
    
    if int(size) > 100 or int(size) < 5:
        size = 20
    recommendations = []
        
    five_ids = random.sample(track_ids, 5)
    ids = ','.join(five_ids)
    url = f"https://api.spotify.com/v1/recommendations?limit={str(size)}&seed_tracks={ids}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = get(url, headers=headers)
    response_json = response.json()
    for track in response_json["tracks"]:
        recommendations.append(track["id"])

    return list(set(recommendations))

def create_and_populate(access_token,user_id,track_ids,name = "My New Playlist",description="A description of the playlist"):
    url = f"https://api.spotify.com/v1/users/{user_id}/playlists"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    data = {
        "name": name,
        "description": description,
        "public": False
    }
    response = post(url, headers=headers, data=json.dumps(data))
    playlist_id = response.json()["id"]

    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    data = {
        "uris": [f"spotify:track:{track_id}" for track_id in track_ids]
    }
    response2 = post(url, headers=headers, data=json.dumps(data))



auth_url = get_auth_url()
print(f"Open this URL in your browser to authorize the application:\n{auth_url}")
code = input("Enter the authorization code: ")
access_token, refresh_token = get_token(code)
user_data = get_user_data(access_token)
user_id = user_data["id"]

#to refresh access token (not necessary)
access_token, refresh_token = get_token(refresh_token=refresh_token)

print(" ")
print(f"Access Token: {access_token}")
print(f"Refresh Token: {refresh_token}")
print(f"User ID: {user_id}")

top_tracks = get_top_tracks(access_token)
saved_tracks = get_saved_songs(access_token)

name = input("Enter playlist name:")
description = input("Enter playlist description:")
size = 0
size = input("Enter playlist size:")

if len(saved_tracks) > 5:
    track_ids = get_recommendations(top_tracks + saved_tracks, access_token,int(size)-10) + random.sample(top_tracks, 5) + random.sample(saved_tracks, 5)
else:
    track_ids = get_recommendations(top_tracks + saved_tracks, access_token,int(size)-5) + random.sample(top_tracks, 5)

shuffled_ids = random.sample(track_ids, len(track_ids))

create_and_populate(access_token,user_id,shuffled_ids,name,description)
print("Playlist Created")
{% endhighlight %}

Here's an example of a generated playlist:
![Example playlist](/assets/images/examplePlaylist.png)
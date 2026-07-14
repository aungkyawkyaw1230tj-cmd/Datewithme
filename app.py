import os
from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__)

# Render Environment Variables
RAPID_KEY = os.getenv('RAPIDAPI_KEY')
PANDA_TOKEN = os.getenv('PANDASCORE_TOKEN')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/football-matches')
def get_football():
    today = "2026-07-14" 
    url = f"https://sportapi7.p.rapidapi.com/api/v1/category/1/scheduled-events/{today}"
    headers = {"x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": "sportapi7.p.rapidapi.com"}
    response = requests.get(url, headers=headers)
    return jsonify(response.json())

@app.route('/api/esports-matches')
def get_esports():
    url = "https://api.pandascore.co/matches?per_page=10"
    headers = {"Authorization": f"Bearer {PANDA_TOKEN}"}
    response = requests.get(url, headers=headers)
    return jsonify(response.json())

if __name__ == '__main__':
    app.run()

from flask import Flask, render_template
import os

app = Flask(__name__)

@app.route('/')
def index():
    return "<h1>System is working!</h1>"

if __name__ == '__main__':
    # Render အတွက် Port ပေးဖို့ လိုနိုင်ပါတယ်
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

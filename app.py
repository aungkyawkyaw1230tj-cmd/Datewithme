from flask import Flask, render_template
import traceback

app = Flask(__name__)

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        return str(traceback.format_exc()) # Error တက်ရင် ဘာဖြစ်လို့လဲဆိုတာ Browser ပေါ်မှာ တန်းပြလိမ့်မယ်

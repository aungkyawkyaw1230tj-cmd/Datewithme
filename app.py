from flask import Flask, render_template

app = Flask(__name__)

# ပင်မစာမျက်နှာ (index.html ကို ပြပေးမယ့် code)
@app.route('/')
def index():
    return render_template('index.html')

# တခြား API route တွေ ရှိရင် ဒီအောက်မှာ ဆက်ရေးပါ
# ဥပမာ - @app.route('/api/get-matches') ...

if __name__ == '__main__':
    app.run()

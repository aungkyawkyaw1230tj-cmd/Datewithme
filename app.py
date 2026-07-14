from flask import Flask, render_template

app = Flask(__name__)

# အဓိက Index Page
@app.route('/')
def index():
    # templates folder ထဲက index.html ကို ခေါ်ပြပေးမယ်
    return render_template('index.html')

# (Backend API routes တွေရှိရင် ဒီအောက်မှာ ဆက်ထည့်သွားပါ)

if __name__ == '__main__':
    app.run()

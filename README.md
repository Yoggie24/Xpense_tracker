# 💰 Simple Money Tracker - Beginner Friendly!

A beautiful, simple money tracker that works on **both PC and mobile phone**!

## ✨ Features

- ✅ Track income and expenses
- ✅ Beautiful, modern design
- ✅ Works on PC and mobile browsers
- ✅ No installation needed
- ✅ No database setup required
- ✅ Data saved automatically in your browser
- ✅ Categories for organizing transactions
- ✅ See total balance, income, and expenses (with charts)
- ✅ Export to Excel/CSV support
- ✅ New categories: Social and Jajan
- ✅ Delete individual transactions
- ✅ Clear all data option
- ✅ **Secure Numeric PIN Login** (NEW!)
- ✅ **Direct Cloud Sync** via GitHub Repository (NEW!)

## 🚀 How to Use (Super Easy!)

### Step 1: Open the App

1. Go to the folder: `b:\Workspace\Keuangan\simple-money-tracker`
2. Double-click on `index.html`
3. It will open in your browser!

**That's it!** No installation, no setup, no database! 🎉

### Step 2: Add Your First Transaction

1. Enter a description (e.g., "Lunch", "Salary")
2. Enter the amount in Rupiah
3. Choose a category
4. Click "Expense" or "Income"
5. Click "Add Transaction"

### Step 3: View Your Money

- See your **total balance** at the top
- See all **income** and **expenses**
- View all your **recent transactions** below

### Step 4: Advanced Features

- **Settings Tab**: Click the "Settings" tab to manage configurations.
- **Import Data**: Upload your `Keuangan.xlsx` file to sync data from Excel.
- **Load from Repository**: Sync your latest local data to the online site with one click!
- **Security**: Set a numeric PIN to protect your financial information.
- **Live Rates**: Check current USD and Gold prices in the Settings tab.
- **Export**: Click "Export Excel" to save your transactions.

## 📱 Use on Mobile Phone

### Option 1: Same WiFi Network

1. On your PC, find your IP address:
   - Open PowerShell
   - Type: `ipconfig`
   - Look for "IPv4 Address" (e.g., 192.168.1.100)

2. On your phone:
   - Open browser
   - Type: `http://YOUR-IP-ADDRESS/path/to/index.html`

### Option 2: Host on GitHub Pages (Recommended 🚀)

Since you have already pushed your code to GitHub, you can host it for free in just a few clicks!

**How to Setup:**
1. Go to your repository on GitHub.
2. Click on **Settings** (tab at the top).
3. In the left sidebar, click on **Pages**.
4. Under **Source**, select `Deploy from a branch`.
5. Under **Branch**, select `main` (or `master`) and keep folder as `/ (root)`.
6. Click **Save**.
7. Wait about 30-60 seconds, then refresh the page.
8. You will see a link like: `https://yourusername.github.io/repository-name/`

**Click that link to open your live app!**
You can now share this URL with your phone or friends.

For this repository, the website is at <https://yoggie24.github.io/Xpense_tracker/>.
After making local changes, run `push_to_github.bat` from this project to safely sync
the `main` branch; GitHub Pages may take a few minutes to publish the update.

The publish script syncs the website files, not browser data. Transactions stored on
your PC are separate from the data stored by the website on your phone. Use the
export/import steps below to move transactions between devices.

### Share a Demo

Share <https://yoggie24.github.io/Xpense_tracker/?demo=1> to let people try the app
with sample transactions. Demo changes use a separate browser-storage namespace and
do not overwrite the app's normal transactions. Spreadsheet sync and live rate
connections are disabled in demo mode. Visitors can reset the demo from its banner;
collect their feedback through your private chat.

## 🔄 How to Sync Data (Local to Online)

Because this app runs in your browser, data is stored separately on each device/website.
To move your data from Local (PC) to Online (GitHub Pages):

1. **On Local (PC):**
   - Open the app.
   - Go to **Transactions** tab.
   - Click **📊 Export Excel**.
   - A file named `Keuangan-yyyy-mm-dd.xlsx` will download.

2. **On Online (GitHub Pages):**
   - Open your hosted app link.
   - Go to **Settings** tab.
   - Under **Import Data**, click **📄 Choose File...**.
   - Select the `Keuangan-....xlsx` file you just downloaded.
   - Done! Your transactions and settings are now synced.

## 🔐 Security (PIN Protection)

Your financial data is private. To protect it:

1. Open the app (Local or Online).
2. Go to the **Settings** tab.
3. Look for the **Security** section.
4. Click **Setup PIN**, enter a numeric code (e.g., `1234`), and click **Save**.
5. **Next time you open the app**, you will be asked for your PIN before seeing any data!

> [!NOTE]
> Your PIN is saved securely as a "hash" (a digital fingerprint). It is **not** stored as a readable number on GitHub, ensuring your real password remains secret even in a public repository.

## 📂 Files Explained (Simple!)

```
simple-money-tracker/
├── index.html    ← The page structure (what you see)
├── style.css     ← The design (how it looks)
├── script.js     ← The functionality (how it works)
└── README.md     ← This file (instructions)
```

### What Each File Does:

**index.html** - The Structure
- Creates the form to add transactions
- Shows the balance
- Displays the list of transactions

**style.css** - The Design
- Makes it look beautiful
- Purple gradient background
- Smooth animations
- Works on mobile and PC

**script.js** - The Brain
- Saves your data in browser
- Calculates totals
- Adds/deletes transactions
- Formats money in Rupiah

## 💾 Where is My Data Saved?

Your data is saved in your **browser's localStorage**. This means:

✅ **Pros:**
- No internet needed
- No database setup
- Fast and simple
- Private (only on your device)

⚠️ **Important:**
- Data is saved per browser
- If you clear browser data, transactions are deleted
- Different browsers = different data
- To backup: use the browser's export feature (coming soon!)

## 🎨 Customization (Optional)

Want to change colors? Edit `style.css`:

```css
/* Change the main color (line 12) */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Try different colors: */
/* Green: #11998e 0%, #38ef7d 100% */
/* Orange: #f46b45 0%, #eea849 100% */
/* Blue: #4facfe 0%, #00f2fe 100% */
```

## 🔧 Troubleshooting

### Problem: Page doesn't open
**Solution:** Make sure all 3 files are in the same folder

### Problem: Data disappeared
**Solution:** Don't clear browser cache/cookies. Your data is stored there.

### Problem: Doesn't work on phone
**Solution:** Make sure phone and PC are on same WiFi, or upload to web hosting

## 🆕 Future Features (You Can Add!)

Want to learn coding? Try adding:
- [x] Export to Excel
- [x] Charts/graphs
- [ ] Budget limits
- [ ] Monthly reports
- [ ] Multiple currencies
- [ ] Dark mode toggle

## 📖 Learning Resources

This app uses simple technologies:
- **HTML** - Structure
- **CSS** - Design
- **JavaScript** - Functionality

Want to learn? Check out:
- [W3Schools](https://www.w3schools.com/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [freeCodeCamp](https://www.freecodecamp.org/)

## 💡 Tips for Beginners

1. **Start simple** - Just use it as-is first
2. **Backup regularly** - Take screenshots or export data
3. **Experiment** - Try changing colors in CSS
4. **Learn gradually** - Read the code comments
5. **Ask questions** - I'm here to help!

## 🎉 Enjoy!

You now have a working money tracker! No complex setup, no database, no backend. Just open and use!

**Questions?** Just ask me! I'm here to help beginners! 😊

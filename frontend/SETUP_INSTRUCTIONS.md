# Google Maps API Setup - Step by Step Guide

## Why You Need This

The address autocomplete feature requires a Google Maps API key to fetch address suggestions. Without it, the dropdown with suggestions won't appear.

## Step 1: Get a Google Maps API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Click "New Project" or select an existing one
   - Give it a name (e.g., "UniGO")
   - Click "Create"

3. **Enable Required APIs**
   - Go to "APIs & Services" > "Library"
   - Search for "Places API" and click on it
   - Click "Enable"
   - Go back to "Library"
   - Search for "Maps JavaScript API" and click on it
   - Click "Enable"

4. **Create an API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key (it will look like: `AIzaSy...`)

5. **Restrict the API Key (Recommended)**
   - Click on the API key you just created
   - Under "API restrictions", select "Restrict key"
   - Check "Places API" and "Maps JavaScript API"
   - Under "Application restrictions", you can restrict to HTTP referrers
   - For development, you can add: `http://localhost:3000/*`
   - Click "Save"

## Step 2: Add the API Key to Your Project

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Create `.env.local` file** (if it doesn't exist)
   ```bash
   touch .env.local
   ```
   
   Or create it manually in your code editor.

3. **Add your API key to `.env.local`**
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
   
   Replace `your_api_key_here` with the API key you copied from Google Cloud Console.

   **Example:**
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBvOkBvXKXNdYi0pL6DvZ0X0X0X0X0X0X0
   ```

4. **Important: Never commit `.env.local` to git**
   - The `.env.local` file should already be in `.gitignore`
   - Never share your API key publicly

## Step 3: Restart Your Development Server

1. **Stop your current development server**
   - Press `Ctrl + C` in the terminal where the server is running

2. **Start it again**
   ```bash
   npm run dev
   ```
   
   Or if you're using a Makefile:
   ```bash
   make frontend
   ```

## Step 4: Test the Feature

1. **Open your browser**
   - Go to: http://localhost:3000

2. **Test the address input**
   - Click on the "From" or "To" address field
   - Start typing an address (e.g., "Calle Gran Vía")
   - You should see a dropdown with suggestions appearing below the input
   - Click on a suggestion to select it

## Troubleshooting

### Dropdown doesn't appear

1. **Check if the API key is set**
   - Open `.env.local` file
   - Make sure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set correctly
   - Make sure there are no extra spaces or quotes

2. **Check if the server was restarted**
   - Environment variables are only loaded when the server starts
   - You must restart the server after adding/changing `.env.local`

3. **Check the browser console**
   - Open browser DevTools (F12 or Right-click > Inspect)
   - Go to the "Console" tab
   - Look for any error messages related to Google Maps

4. **Verify API key is enabled**
   - Go to Google Cloud Console
   - Check that "Places API" and "Maps JavaScript API" are enabled
   - Check that your API key has these APIs enabled

### API key errors

1. **"This API key is not authorized"**
   - Make sure you enabled "Places API" and "Maps JavaScript API"
   - Check that your API key restrictions allow the APIs

2. **"REQUEST_DENIED" error**
   - Check that your API key is correct
   - Check that the APIs are enabled
   - Check that billing is enabled (Google Cloud requires billing for these APIs)

3. **Billing required**
   - Google Cloud requires billing to be enabled for Maps APIs
   - However, Google provides $200 free credit per month
   - This is usually more than enough for development and testing

## Cost Information

- Google Maps provides $200 free credit per month
- The Places API costs approximately $0.017 per request
- This means you can make about 11,000 requests per month for free
- For development and testing, this is usually more than enough

## Next Steps

Once the API key is set up and the dropdown is working:
1. The error message should disappear when you see suggestions
2. You can click on any suggestion to select it
3. The selected address will be validated and used in your search

## Need Help?

If you're still having issues:
1. Check the browser console for errors
2. Verify the API key is correct in `.env.local`
3. Make sure the development server was restarted
4. Check that the APIs are enabled in Google Cloud Console


#!/bin/bash

# Script to push to git and redeploy to Vercel

echo "🚀 Starting deployment process..."

# Step 1: Check for changes and commit if needed
echo "📝 Checking for changes..."
if [ -n "$(git status --porcelain)" ]; then
    echo "   Changes detected. Adding and committing..."
    git add .
    read -p "   Enter commit message (or press Enter for default): " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Update: $(date +'%Y-%m-%d %H:%M:%S')"
    fi
    git commit -m "$commit_msg"
else
    echo "   No uncommitted changes found."
fi

# Step 2: Push to git
echo "📤 Pushing to git..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to git"
else
    echo "❌ Failed to push to git"
    exit 1
fi

# Step 3: Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed to Vercel"
else
    echo "❌ Failed to deploy to Vercel"
    exit 1
fi

echo "🎉 Deployment complete!"


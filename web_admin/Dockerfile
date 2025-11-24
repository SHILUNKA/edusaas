# Use the same Node version you have
FROM node:20-alpine

WORKDIR /app

# --- THIS IS THE FIX ---
# We explicitly copy BOTH package.json AND package-lock.json
# This tells Docker: if EITHER of these files changes,
# you MUST re-run the "npm ci" step below.
COPY package.json package-lock.json* ./

# Use "npm ci" (Clean Install) instead of "npm install".
# It's faster and safer for Docker because it ONLY uses package-lock.json
# RUN npm ci
RUN npm install

# Now copy the rest of the application code
COPY . .

EXPOSE 3000

# This command is correct
CMD ["npm", "run", "dev"]
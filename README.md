
# StackIt – AI-Powered Developer Insights Platform

## 🚀 Overview

StackIt is a modern platform where developers **write, share, and learn** through articles, stories, and insights. Built with cutting-edge technologies, it blends **AI assistance** with **community-driven knowledge sharing**, creating a space for developers to grow, collaborate, and inspire each other.

---

## ✨ Key Features

- 🤖 **AI-Powered Assistance** – Get intelligent suggestions and improve your writing with Gemini AI
- 📝 **Articles & Insights** – Share tutorials, stories, and experiences with the community
- 👥 **Community Collaboration** – Learn from fellow developers through shared knowledge
- 🔐 **Secure Authentication** – Safe and reliable user accounts
- 🎨 **Rich Text Editor** – Write and format your posts beautifully
- 🏷️ **Smart Tagging** – Organize articles by technology and topic
- 🔔 **Real-time Notifications** – Stay updated on community activity
- 💻 **Modern UI** – Clean, responsive design with dark/light mode

---

## 🛠️ Built With

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express
- **AI:** Google Gemini AI
- **Database:** Drizzle ORM with PostgreSQL

---

## ⚡ Quick Start

### Requirements

- Node.js 18 or higher
- PostgreSQL database
- Google AI API key

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd "StackIt"
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the root directory and add:

   ```env
   DATABASE_URL=your_postgresql_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   SESSION_SECRET=your_random_secret_key
   ```

3. **Initialize the database**

   ```bash
   npm run db:push
   ```

4. **Start the application**

   ```bash
   npm run dev
   ```

5. **Visit** [http://localhost:5173](http://localhost:5173) to explore StackIt.

---

## 🤝 Contributing

We’d love your contributions!

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

Please follow the project’s coding style and add tests for new features.

---

## 🙏 Thanks

Thanks for being part of StackIt — together, we’re shaping the future of developer knowledge sharing powered by AI.

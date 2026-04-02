# AshtaChamma – Online Multiplayer Board Game

A real-time multiplayer implementation of the traditional Indian board game **Ashta Chamma**, featuring synchronized turn-based gameplay, a custom sound engine, and personal point-of-view perspectives.

---

## 🚀 Live Demo
*Play here: [ashtachamma.tech](https://ashtachamma.tech)*

---

## 🎮 About the Game

Ashta Chamma is a traditional Indian board game played on a 5x5 grid. Players race their pawns to the center by rolling dice (Tamarind seeds or Cowrie shells). 

This project recreates the ancient experience in a modern digital format, allowing friends to play together in real-time across the globe with full rule enforcement and an organic "wooden" aesthetic.

---

## ✨ Features

- 🎲 **Real-time Multiplayer**: Powered by Socket.io for low-latency synchronization.
- 🔄 **Personalized Perspectives**: Every player sees themselves as the "Primary" player at the bottom of the board without rotating the pieces upside down.
- 👥 **Private Rooms**: Create game rooms and invite friends using unique 6-character codes.
- 🪵 **Organic Sound Engine**: Custom HTML5 Audio engine featuring warm, wooden "taps" for authentic gameplay feedback.
- 🧠 **Dynamic Rule Enforcement**: Automatic handling of "Kill to Unlock" entry, safe cells, and paired pawn movements.
- ⚡ **Responsive UI**: Seamlessly transitions between Desktop and Mobile layouts.
- 🔁 **State Persistence**: Handles reconnections gracefully by syncing the latest server-side state.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express.js.
- **Real-time**: Socket.io / WebSockets.
- **Database**: PostgreSQL (for room and session management).
- **Deployment**: Render / PostgreSQL.

---

## 🧠 System Design Highlights

- **Static Perspective Mapping**: Implemented a slot-based mapping system where the board container rotates relative to the viewer's position, while pawns apply a counter-rotation to remain upright and readable.
- **Hybrid State Management**: Solved React's "stale closure" challenges in real-time listeners by utilizing `useRef` for visual state synchronization within Socket.io callbacks.
- **Animation-Timer Sync**: Designed a server-side delay mechanism (1500ms) that waits for client-side movement animations to complete before starting the clock for the next player's turn.
- **Idempotent Move Processing**: Backend validated actions to ensure turn order and prevent race conditions or double-moves during high latency.

---

## ⚡ Challenges & Learnings

- **Real-time Synchronization**: Bridging the gap between a high-speed JavaScript game engine and network latency required implementing sophisticated pending-state queues.
- **Organic Feel**: Building a custom audio-context engine instead of using simple MP3 triggers to create "randomized pitch" wood taps, making the game feel more analog and less digital.
- **Complex UI Logic**: Managing a 25-cell grid with overlapping pawns, animation paths, and kill-replays in a functional React-component architecture.

---

## 🚀 Getting Started

### Prerequisites
- Node.js installed
- A PostgreSQL database instance

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/balalji0931/AshtaChamma.git
   ```

2. **Install dependencies**
   ```bash
   cd AshtaChamma
   npm install
   ```

3. **Environment Setup**
   - Create a `.env` in the root and add your `DATABASE_URL` and `PORT`.

4. **Start the Application**
   - Run the full stack with:
     ```bash
     npm run dev  # (or equivalent start script)
     ```

---

## 🔮 Future Improvements

- **Matchmaking**: Global lobby for playing with random opponents.
- **Chat System**: In-game emojis and quick-chat functionality.
- **Custom Themes**: More board skins including "Temple Gold" and "Ancient Scroll" styles.
- **Scalability**: Implementing Redis for distributed socket scaling across multiple 

---

*Made with ❤️ by [Balaji Nayak Bardawal](https://github.com/balaji0931)*

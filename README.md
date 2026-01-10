# Miami Hurricanes - CFB Roster Portal 🏈

An interactive, data-driven web application for exploring the Miami Hurricanes football roster, depth charts, and player statistics. Built with modern web technologies and inspired by EA Sports' depth chart management interface.

![Miami Hurricanes](https://img.shields.io/badge/Team-Miami%20Hurricanes-orange?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)

## Features

### Tab 1: Team Metrics 📊
- **Overall Team Rating**: Composite score based on recruiting rankings of all starters
- **Offensive Metrics**: Average position recruiting rankings for offensive starters
- **Defensive Metrics**: Average position recruiting rankings for defensive starters
- Real-time calculations displayed in the header

### Tab 2: Interactive Depth Chart 🎮
- **Dynamic Formation View**: Toggle between Offense and Defense
- **Visual Position Layout**: Players positioned like actual football formations
- **Player Cards**: Compact design featuring:
  - Position
  - Last Name
  - Overall Rating (OVR) with color-coded gradient
  - Star Recruiting Ranking (⭐)
  - Seniority badges (FR/SO/JR/SR with color coding)
  - Redshirt indicator (RS)
  - Portal transfer indicator (PTL)
  - Jersey number
- **Starter & Backup Display**: Clear visual hierarchy
- **Smooth Animations**: Staggered fade-in effects for enhanced UX

### Tab 3: Ratings & Filters 🔍
- **Advanced Filtering**: By side (OFF/DEF), position, star rating
- **Multiple Sort Options**: Composite score, overall rating, or star rating
- **List View**: All players with detailed information
- **Quick Search**: Find players by any attribute

### Player Details Modal 💾
Click any player to view:
- Full name, position, year, and jersey number
- Recruiting star rating and composite score
- Height and weight
- 2025 season statistics
- Portal transfer status
- Visual indicators and color-coded metrics

## Data Sources

This application uses authentic data from:
- **Depth Charts**: Based on Ourlads roster information
- **Player Stats**: 2025 season statistics from ESPN
- **Recruiting Data**: 247Sports composite rankings and position ratings

## Technology Stack

- **React 18.3** - Modern UI library with hooks
- **Vite 6.0** - Lightning-fast build tool and dev server
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **JavaScript/JSX** - Component-based architecture

## Getting Started

### Prerequisites

Make sure you have Node.js installed (v18 or higher recommended):
```bash
node --version
npm --version
```

### Installation

1. **Clone or navigate to the repository:**
```bash
cd Claude_Test
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the development server:**
```bash
npm run dev
```

4. **Open your browser:**
The application will automatically open at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Starts the development server with hot reload
- `npm run build` - Creates optimized production build
- `npm run preview` - Preview the production build locally

## Project Structure

```
Claude_Test/
├── src/
│   ├── App.jsx          # Main application component (Miami roster)
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles with Tailwind
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
└── README.md            # This file
```

## Design Inspiration

The interface is inspired by:
- **EA Sports College Football** depth chart management
- Modern data visualization principles
- Mobile-first, responsive design
- High-contrast, readable typography
- Smooth animations and transitions

## Color Coding System

### Overall Ratings (OVR)
- 🟡 **Gold** (90+): Elite players
- 🟢 **Lime** (85-89): Excellent players
- 🟢 **Green** (80-84): Very good players
- 🔵 **Teal** (75-79): Good players
- 🔵 **Cyan** (<75): Solid players

### Class Year
- 🟢 **Green**: Freshmen (FR)
- 🔵 **Blue**: Sophomores (SO)
- 🟡 **Yellow**: Juniors (JR)
- 🔴 **Red**: Seniors (SR)

### Special Indicators
- 🟣 **Purple Badge (RS)**: Redshirt player
- 🟠 **Orange Badge (PTL)**: Portal transfer

## Features Roadmap

Future enhancements could include:
- [ ] Multi-team support (expand beyond Miami)
- [ ] Historical roster comparisons
- [ ] Player comparison tool
- [ ] Export depth chart as image
- [ ] Mobile app version
- [ ] Live stats integration
- [ ] Injury report tracking
- [ ] Recruiting class analysis

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Initial load: ~50ms
- Smooth 60fps animations
- Optimized React rendering
- Minimal bundle size with Vite

## License

This project is for demonstration and educational purposes.

## Acknowledgments

- **Miami Hurricanes** - Official team
- **Ourlads** - Depth chart information
- **ESPN** - Player statistics
- **247Sports** - Recruiting rankings

---

Built with ❤️ for college football fans everywhere. Go Canes! 🙌

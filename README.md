# N2 Reader - Japanese Reading Comprehension PWA

A mobile-first Progressive Web App for daily Japanese reading comprehension practice, powered by your WaniKani progression.

## Features

✨ **Core Features:**
- Daily reading recommendations based on your WaniKani level
- Short, curated Japanese passages (3-10 minutes)
- Comprehension questions with instant feedback
- Reading timer and progress tracking
- Complete offline support after initial setup
- Installable as a native app on iOS and Android
- Local data persistence

✨ **WaniKani Integration:**
- Reads your current WaniKani level and progression
- Analyzes which kanji and vocabulary you know
- Identifies weak items for targeted review
- Recommends passages with optimal difficulty
- Tracks recent learning to reinforce knowledge

✨ **Simple & Clean:**
- Mobile-first design
- Minimal, focused interface
- No account creation needed
- Privacy-first: all data stored locally

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- WaniKani API token (get one from [wanikani.com/settings](https://wanikani.com/settings/personal_access_tokens))

### Installation

```bash
# Clone or download the project
cd japanese-reading-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

### First Time Setup

1. **Get your WaniKani API token:**
   - Go to [wanikani.com/settings/personal_access_tokens](https://wanikani.com/settings/personal_access_tokens)
   - Create a new token with "read" access
   - Copy the token

2. **Connect to the app:**
   - On the setup screen, paste your API token
   - Click "Connect"
   - The app will fetch your WaniKani data
   - You're ready to start!

### Usage

**Home Screen:**
- See your daily recommended reading passage
- View your stats (streak, total sessions, average score)
- Understand why this passage was recommended

**Reading Session:**
- Read the Japanese passage at your own pace
- Optional timer to track reading speed
- Click "Continue to Questions" when done

**Questions:**
- Answer 3-5 multiple-choice comprehension questions
- Get immediate feedback on each answer
- Review explanations

**Results:**
- View your score and answer review
- Rate the difficulty of the session
- See time breakdown if you used the timer

**History:**
- Track all your previous sessions
- See trends in your scores
- Monitor your reading streak

## Building for Production

```bash
# Build for deployment
npm run build

# Preview the build locally
npm run preview
```

The production build is optimized and ready for deployment to any static host (Netlify, Vercel, GitHub Pages, etc.).

## Deployment

### Option 1: Netlify (Recommended)
```bash
npm run build
# Drag and drop the 'dist' folder to Netlify
```

### Option 2: Vercel
```bash
npm i -g vercel
npx vercel
```

### Option 3: GitHub Pages
1. Update `vite.config.ts` to set `base: '/repo-name/'`
2. Build and push to GitHub
3. Enable Pages in repository settings

### Option 4: Your Own Server
Copy the contents of the `dist` folder to your web server.

## PWA Installation

### On Android Chrome:
1. Open the app in Chrome
2. Tap the menu (⋮)
3. Tap "Install app"

### On iOS Safari:
1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Full page components
│   ├── Setup.tsx       # WaniKani connection
│   ├── Home.tsx        # Daily recommendation
│   ├── Reading.tsx     # Passage display
│   ├── Questions.tsx   # Q&A session
│   ├── Results.tsx     # Score & feedback
│   └── History.tsx     # Session history
├── services/           # API & storage
│   ├── wanikani.ts     # WaniKani API client
│   └── storage.ts      # Local storage management
├── lib/                # Business logic
│   ├── recommendation.ts # Passage scoring & recommendation
│   └── utils.ts        # Helper functions
├── hooks/              # Custom React hooks
│   └── useSession.ts   # Session state management
├── data/               # Local data
│   └── passages.ts     # Reading passages corpus
├── types/              # TypeScript definitions
│   └── index.ts
├── App.tsx             # Root component
├── main.tsx            # Entry point
└── index.css           # Styling

public/
├── manifest.json       # PWA manifest
└── service-worker.js   # Offline support
```

## How It Works

### Recommendation Algorithm

The app scores each passage based on:

1. **Coverage** (60%): % of kanji/vocabulary you already know
2. **Weak Items Bonus** (20%): passages including items you're struggling with
3. **Recent Items Bonus** (10%): passages with newly learned items
4. **Difficulty Multiplier**: slight preference for "normal" difficulty
5. **Completion Filter**: excludes already-completed passages

The passage with the highest score becomes today's recommendation.

### Knowledge Model

Built from WaniKani API data:
- **Known items**: SRS stage 5+ (Guru and above)
- **Weak items**: Low SRS stage or low review accuracy
- **Recent items**: Unlocked within the last month

## Corpus Data

The app includes 10+ pre-curated Japanese reading passages at various difficulty levels:

- **Themes**: daily-life, society, work, culture, history, education, health, opinion
- **Lengths**: 3-8 minutes reading time
- **Questions**: 3-5 multiple-choice per passage
- **Content**: Realistic, interesting, and aligned with JLPT N2

Each passage includes:
- Kanji and vocabulary lists
- Question types (main idea, detail, inference, intention)
- Explanations for all answers

## Customization

### Add More Passages
Edit `src/data/passages.ts` and add new items to the `passages` array. Each passage needs:
```typescript
{
  id: 'unique-id',
  title: 'Title',
  summary: 'Brief summary',
  theme: 'category',
  difficulty: 'easy' | 'normal' | 'hard',
  text: 'Japanese text...',
  estimatedMinutes: 5,
  kanjiList: ['字', '詞'],
  vocabList: ['単語', '言葉'],
  questions: [/* ... */]
}
```

### Adjust Scoring
Edit `src/lib/recommendation.ts` in the `scorePassage` function to change how passages are scored.

### Styling
Global styles in `src/index.css`. Components use Tailwind CSS classes. Customize theme in `tailwind.config.js`.

## Data Privacy

- **No server**: All data stays on your device
- **No analytics**: No tracking or data collection
- **No ads**: Completely ad-free
- **WaniKani API**: Only reads your public progression data
- **Local storage**: All sessions stored in browser only

## Offline Usage

- Works fully offline after initial WaniKani data fetch
- Can read passages, answer questions, track progress without internet
- Syncs new data with WaniKani when online

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Chrome Android
- Mobile Safari iOS 14+

## Next Logical Improvements

1. **Furigana Support** - Add furigana toggle for kanji reading help
2. **Backend Sync** - Store progress in cloud for cross-device sync
3. **Corpus Expansion** - Integrate automatic quality passage sourcing
4. **Advanced Analytics** - Track comprehension trends by theme
5. **Free-text Answers** - Add open-ended questions with AI feedback
6. **Spaced Repetition** - Integrate SRS for passage recycling
7. **Kanji Highlighting** - Highlight known vs unknown kanji in passages
8. **Audio Support** - Add native speaker audio to passages
9. **Community Features** - Share passages and compete on leaderboards
10. **Grammar Notes** - Add grammar explanations for passages

## Troubleshooting

**"Invalid API token" error**
- Double-check your WaniKani API token
- Ensure the token has "read" permissions
- Get a new token from [wanikani.com/settings](https://wanikani.com/settings/personal_access_tokens)

**No passages recommended**
- You may have completed all passages! Add more to `src/data/passages.ts`
- Or lower the unknown item threshold in `recommendation.ts`

**Data not persisting**
- Check browser localStorage is enabled
- Try a different browser
- Clear cache and reload

**Service worker not updating**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check service worker in DevTools

## Development

### Running Tests
```bash
# Unit tests
npm test

# End-to-end tests
npm run test:e2e
```

### Debugging
1. Open DevTools (F12)
2. Go to Application tab
3. Check Local Storage and Service Worker status
4. Check the Console for errors

### Adding Features
1. Create new files in appropriate directories
2. Follow existing component patterns
3. Use TypeScript for type safety
4. Test in mobile viewport (DevTools)

## License

This project is open source. Feel free to use it for personal study.

## Contributing

Found a bug or have an idea? Create an issue or submit a pull request!

---

**Happy reading! 📚日本語を頑張って！**

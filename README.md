# Figma Automator

A powerful Norwegian outreach automation tool that generates personalized sales emails for companies listed on Proff.no.

## Features

- 🔐 **Secure Setup Flow**: First-run setup with credential validation for OpenAI, Notion, and optional scraping APIs
- 🔍 **Company Intelligence**: Automatically scrapes Proff.no for company information and Styrets leder
- 🌐 **Website Analysis**: Analyzes company websites and generates contextual observations
- 🤖 **AI-Powered Emails**: Uses GPT-4 to generate professional Norwegian outreach emails
- � **Screenshot Capture**: Automatically captures desktop and mobile screenshots of company websites
- 🎨 **Sanity CMS Integration**: Creates presentation documents with "before" images for visual proposals
- �📊 **Notion Integration**: Automatically creates CRM entries with follow-up dates
- 🎯 **Service-Specific**: Supports Video, Images, Web, and Branding services
- 🔒 **Security First**: Server-side secret management, rate limiting, and no credential exposure

## Tech Stack

- **Frontend**: React 19, TypeScript, SCSS Modules, React Router
- **Backend**: Express, Node.js, TypeScript
- **AI**: OpenAI GPT-4
- **Database**: Notion API
- **Scraping**: Cheerio, Axios
- **Security**: Helmet, CORS, Express Rate Limit

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- OpenAI API key
- Notion integration token and database ID

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up your Notion database with these properties:

   - Selskap (title)
   - Kontaktperson (text)
   - E-post (email)
   - Hjemmeside (url)
   - Proff-link (url)
   - Tjeneste (select: Video, Images, Web, Branding)
   - Status (select: Ongoing)
   - Contact Date (date)
   - Follow-up Date (date)
   - Melding jeg sendte (text)

4. (Optional) Set up Sanity CMS for presentation generation:

   - Create a Sanity project at https://www.sanity.io/manage
   - Get your project ID, dataset name (typically "production"), and create a token
   - Add the credentials to your `.env` file

5. Start the development servers:

```bash
npm run dev
```

This will start:

- Backend server on http://localhost:3001
- Frontend app on http://localhost:3000

### Initial Setup

1. Navigate to http://localhost:3000
2. You'll be redirected to the setup page
3. Enter your API credentials:
   - OpenAI API Key (from https://platform.openai.com/api-keys)
   - Notion Token (from https://www.notion.so/my-integrations)
   - Notion Database ID (from your database URL)
4. Click "Save & Test" to validate credentials
5. Once validated, you'll be redirected to the main app

## Usage

1. **Paste Proff.no URL**: Enter the URL of a company from Proff.no
2. **Select Service**: Choose Video, Images, Web, or Branding
3. **Generate**: Click the generate button
4. **Review**: Check the generated email, company info, and contact details
5. **Automatic Processing**:
   - Screenshots are captured from the company website (desktop and mobile)
   - A Sanity presentation is created with "before" images populated
   - A Notion entry is created for CRM tracking
6. **Action**: Copy email to clipboard or open in your email client
7. **Follow-up**: Use the Sanity presentation for visual proposals

### Sanity Integration

When a company website is found, the system will:

1. Capture desktop (1440x900) and mobile (393x852) screenshots
2. Upload the screenshots to Sanity as "before" images
3. Create a presentation document with:
   - Title slide with company name
   - Before & After slide (only "before" images populated)
   - Thank you slide
4. The "after" images are intentionally left empty to use industry presets in your Sanity studio

The presentation can then be customized in your Sanity studio with the appropriate "after" images for the proposal.

## Development Scripts

```bash
npm start          # Start frontend only
npm run server     # Start backend only
npm run dev        # Start both (recommended)
npm run build      # Build for production
npm test           # Run tests
```

## Environment Variables

See `.env.example` for all required environment variables.

## Rate Limits

- Setup endpoints: 10 requests per 15 minutes
- Generation endpoint: 20 requests per hour
- Per IP address

## Security Features

- ✅ Server-side secret storage
- ✅ Password-masked inputs
- ✅ No credentials sent to client
- ✅ Rate limiting on all endpoints
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation
- ✅ Error sanitization in production

## License

MIT

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

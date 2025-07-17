# East Coast Credit Union Banking Application

## Overview

This is a full-stack Canadian credit union banking application built with React, Express.js, and PostgreSQL. The application provides secure online banking features including account management, transaction history, bill payments, cheque orders, and external account linking with OTP verification.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Express sessions with PostgreSQL session store
- **Password Security**: bcrypt for password hashing
- **Email Service**: Nodemailer with Gmail SMTP

## Key Components

### Authentication System
- Session-based authentication with persistent login
- Two-factor authentication using OTP codes sent via email
- Secure password hashing with bcrypt
- Session storage in PostgreSQL for scalability

### Database Schema
- **Users**: Customer information and credentials
- **Accounts**: Multiple account types (chequing, savings, TFSA, term deposits)
- **Transactions**: Complete transaction history with categorization
- **OTP Codes**: Time-limited verification codes for secure operations
- **Bill Payments**: Bill payment records and verification
- **Cheque Orders**: Cheque order management
- **External Accounts**: External bank account linking with micro-deposits
- **Sessions**: Secure session management

### Banking Features
- **Account Dashboard**: Real-time balance display with interactive charts
- **Transaction History**: Filterable transaction list with search capabilities
- **Bill Payments**: Secure bill payment system with OTP verification
- **Cheque Orders**: Digital cheque ordering with delivery tracking
- **External Account Linking**: Micro-deposit verification system
- **Mobile-Responsive Design**: Optimized for all device sizes

## Data Flow

### Authentication Flow
1. User enters credentials:
   - Primary user: userId: 920200, password: EastM@ple$2025 (Mate Smith)
   - Secondary user: userId: 197200, password: Mate@200 (Martha Hodge)
2. Server validates credentials and creates session
3. OTP code generated and sent via email
4. User enters OTP for verification
5. Session established and user redirected to dashboard

### Transaction Flow
1. User initiates banking action (bill payment, cheque order, etc.)
2. Server validates request and creates pending record
3. OTP code generated and sent via email
4. User verifies OTP to complete transaction
5. Transaction processed and confirmation sent

### Data Persistence
- Session data stored in PostgreSQL sessions table
- All banking data persisted in relational database
- Transaction history maintained for audit compliance
- OTP codes have automatic expiration for security

## External Dependencies

### Database
- **Neon Database**: PostgreSQL hosting service
- **Drizzle ORM**: Type-safe database operations
- **Connection Pooling**: Efficient database connection management

### Email Service
- **Nodemailer**: Email sending library
- **Gmail SMTP**: Email delivery service
- **OTP Generation**: Secure 6-digit code generation

### UI Components
- **Radix UI**: Headless UI components for accessibility
- **Lucide React**: Icon library
- **Chart.js**: Data visualization for account balances
- **Tailwind CSS**: Utility-first styling framework

### Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety and better developer experience
- **ESBuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- Vite development server with hot module replacement
- TypeScript compilation with incremental builds
- Database migrations with Drizzle Kit
- Environment variable management for sensitive data

### Production Build
- Vite builds React frontend to static files
- ESBuild bundles Express server for Node.js
- Database schema deployment via Drizzle migrations
- Environment-specific configuration management

### Security Considerations
- HTTPS enforcement in production
- Secure session cookies with proper flags
- CSRF protection through proper session handling
- Input validation and sanitization
- Rate limiting for authentication endpoints
- Secure password storage with bcrypt

## Recent Changes

### July 17, 2025
- ✓ Fixed database connection issues by creating PostgreSQL database
- ✓ Resolved syntax errors in sampleData.ts (duplicate else statements)
- ✓ Updated header layout: moved "Welcome back" message from top header to Account card
- ✓ Fixed login session persistence issue for OTP verification
- ✓ Updated second user profile: changed name from "Matthew Smith" to "Martha Hodge"
- ✓ Improved session handling with better error logging and session saving

The application follows Canadian banking standards and terminology, including proper formatting for account numbers, transit numbers, and institution numbers. The UI is designed to match East Coast Credit Union's branding with their signature blue color scheme and professional appearance.
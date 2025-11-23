# Space Battle

A decentralized, simultaneous turn-based 4X space strategy game built on blockchain technology, designed to run indefinitely as a persistent living universe.

## Game Overview

Space Battle operates on 24-hour "Epochs" with:

- **22-hour commit phase**: Players secretly plan actions
- **2-hour reveal phase**: All actions resolve simultaneously

Players control an Empire, colonizing star systems, producing spaceship fleets, and expanding territory through conquest and diplomacy.

### Core Gameplay Mechanics

**Fleet Mechanics**: Fleets take multiple epochs to travel between systems based on distance. The commit-reveal system means enemies can't see where your fleets are heading until they arrive, creating deep strategic uncertainty.

**Strategic Depth**: The simultaneous turn system combined with hidden fleet movements creates a unique "fog of war" where players must commit to strategies without knowing enemy intentions. The indefinite duration means diplomatic relationships, territorial legacies, and alliance dynamics evolve organically over months and years.

### Decentralized Architecture

The game runs on blockchain networks with no central servers, ensuring permanent persistence, immutable rules, and true player ownership.

## Technical Architecture

**Smart Contracts**: Built in Solidity - all game logic happens on-chain with deterministic resolution that ensures transaction order doesn't impact results.

**Frontend**: Implemented in Svelte + TypeScript with a custom game engine using Pixi.js for rendering.

**No Backend**: Designed to have no backend server - only an RPC is needed and the game fetches all state directly from the blockchain.

## Development

### Prerequisites

- Node.js and pnpm/npm/yarn
- Connection to a compatible blockchain network (or local development node)

### Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm start
```

The game will be available at `http://localhost:5173`

### Deploying

The game is designed to be deployed as a static frontend that connects to blockchain networks. Configure your target networks in the environment variables and build for production.

More description to come...

## Project Structure

- `src/lib/render/` - Pixi.js rendering engine and game objects
- `src/lib/onchain/` - Blockchain interaction and smart contract interfaces
- `src/lib/operations/` - Game state management and operations
- `src/lib/view/` - Game state types and interfaces
- `static/images/` - Game assets (planet sprites, etc.)

## License

This project is licensed under the AGPL (Affero General Public License) and is part of the EthGlobal hackathon, demonstrating a fully decentralized gaming experience with no backend dependencies.

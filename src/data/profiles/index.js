// Central registry of resume profiles. Add a JSON file and register it here to
// make it appear in the sidebar. Data is fully decoupled from the render engine.
import atharva from './atharva.json'
import priya from './priya.json'
import overflowDemo from './overflow-demo.json'
import atharvaFinance from "./atharvaaFinance.json"
import atharvaAccenture from "./atharvaAccenture.json"

export const profiles = [atharva, priya, overflowDemo, atharvaFinance, atharvaAccenture]

export const profilesById = Object.fromEntries(profiles.map((p) => [p.profileId, p]))

export default profiles

import { STATE_NAMES, type Profile } from '@saathi/core'

/**
 * State and UT government schemes, handed off to myScheme (myscheme.gov.in),
 * the Government of India's official scheme portal, which lists thousands of
 * central and state schemes. Its data API is only open to registered
 * organisations, so for now we link to its official per-state page instead of
 * copying anything.
 *
 * The names are myScheme's own spelling of each state, each checked to open a
 * page listing that state's schemes. A state missing here gets no link rather
 * than a broken one.
 */
const MYSCHEME_STATE_NAMES: Partial<Record<NonNullable<Profile['state']>, string>> = {
  // Verified 2026-09-19: each opens a myScheme page listing that state's schemes.
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DD: 'Dadra & Nagar Haveli and Daman & Diu',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UT: 'Uttarakhand',
  WB: 'West Bengal',
}

export function mySchemeStateLink(state: Profile['state']): { name: string; url: string } | null {
  if (!state) return null
  const mySchemeName = MYSCHEME_STATE_NAMES[state]
  if (!mySchemeName) return null
  return {
    name: STATE_NAMES[state],
    url: `https://www.myscheme.gov.in/search/state/${encodeURIComponent(mySchemeName)}`,
  }
}

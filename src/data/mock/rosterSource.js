export const rosterSource = {
  sourceId: 'internal-roster-v1',
  sourceType: 'roster',
  asOf: '2026-01-15',
  team: 'Miami Hurricanes',
  season: 2026,
  players: [
    { playerId: 'QB-CBECK', name: 'Carson Beck', number: 11, side: 'OFF', position: 'QB', classYear: 'RS SR', height: "6'4\"", weight: 220, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'QB-EWILLIAMS', name: 'Emory Williams', number: 8, side: 'OFF', position: 'QB', classYear: 'RS SO', height: "6'5\"", weight: 220, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'RB-MFLETCHER', name: 'Mark Fletcher Jr.', number: 4, side: 'OFF', position: 'RB', classYear: 'JR', height: "6'2\"", weight: 225, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'WR-KMARION', name: 'Keelan Marion', number: 0, side: 'OFF', position: 'WR', classYear: 'RS SR', height: "6'0\"", weight: 195, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'WR-CJDANIELS', name: 'CJ Daniels', number: 7, side: 'OFF', position: 'WR', classYear: 'RS SR', height: "6'2\"", weight: 205, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'WR-MTONEY', name: 'Malachi Toney', number: 10, side: 'OFF', position: 'WR', classYear: 'FR', height: "5'11\"", weight: 185, eligibilityRemaining: 4, isTransfer: false },
    { playerId: 'TE-ABAUMAN', name: 'Alex Bauman', number: 87, side: 'OFF', position: 'TE', classYear: 'SR', height: "6'5\"", weight: 245, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'LT-MBELL', name: 'Markel Bell', number: 70, side: 'OFF', position: 'LT', classYear: 'SR', height: "6'9\"", weight: 340, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'LG-MMCCOY', name: 'Matthew McCoy', number: 78, side: 'OFF', position: 'LG', classYear: 'RS JR', height: "6'6\"", weight: 290, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'C-JBROCKER', name: 'James Brockermeyer', number: 52, side: 'OFF', position: 'C', classYear: 'RS SR', height: "6'3\"", weight: 295, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'RG-ACOOPER', name: 'Anez Cooper', number: 73, side: 'OFF', position: 'RG', classYear: 'SR', height: "6'6\"", weight: 350, eligibilityRemaining: 1, isTransfer: false },
    { playerId: 'RT-FMAUIGOA', name: 'Francis Mauigoa', number: 61, side: 'OFF', position: 'RT', classYear: 'JR', height: "6'6\"", weight: 315, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'DE-RBAIN', name: 'Rueben Bain Jr.', number: 4, side: 'DEF', position: 'DE', classYear: 'JR', height: "6'3\"", weight: 275, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'DT-DBLAY', name: 'David Blay Jr.', number: 11, side: 'DEF', position: 'DT', classYear: 'RS SR', height: "6'4\"", weight: 303, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'DT-AMOTEN', name: 'Ahmad Moten Sr.', number: 99, side: 'DEF', position: 'DT', classYear: 'RS JR', height: "6'3\"", weight: 325, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'DE-AMESIDOR', name: 'Akheem Mesidor', number: 3, side: 'DEF', position: 'DE', classYear: 'RS SR', height: "6'3\"", weight: 280, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'LB-MTOURE', name: 'Mohamed Toure', number: 1, side: 'DEF', position: 'LB', classYear: 'RS SR', height: "6'2\"", weight: 236, eligibilityRemaining: 1, isTransfer: true },
    { playerId: 'LB-WBISSAINTHE', name: 'Wesley Bissainthe', number: 31, side: 'DEF', position: 'LB', classYear: 'SR', height: "6'1\"", weight: 205, eligibilityRemaining: 1, isTransfer: false },
    { playerId: 'CB-DPORTER', name: 'Damari Brown', number: 26, side: 'DEF', position: 'CB', classYear: 'JR', height: "6'1\"", weight: 185, eligibilityRemaining: 2, isTransfer: false },
    { playerId: 'S-JPOWELL', name: 'Jaden Powell', number: 2, side: 'DEF', position: 'S', classYear: 'SO', height: "6'0\"", weight: 190, eligibilityRemaining: 3, isTransfer: false }
  ],
  depthChart: {
    offense: {
      QB1: 'QB-CBECK', QB2: 'QB-EWILLIAMS',
      RB1: 'RB-MFLETCHER',
      WR1: 'WR-KMARION', WR2: 'WR-CJDANIELS', WR3: 'WR-MTONEY',
      TE1: 'TE-ABAUMAN',
      LT1: 'LT-MBELL', LG1: 'LG-MMCCOY', C1: 'C-JBROCKER', RG1: 'RG-ACOOPER', RT1: 'RT-FMAUIGOA'
    },
    defense: {
      DE1: 'DE-RBAIN', DT1: 'DT-DBLAY', DT2: 'DT-AMOTEN', DE2: 'DE-AMESIDOR',
      LB1: 'LB-MTOURE', LB2: 'LB-WBISSAINTHE',
      CB1: 'CB-DPORTER', S1: 'S-JPOWELL'
    }
  }
};

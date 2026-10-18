/** Shared pacing for the scene, its illustration and the next available action. */
export const TIMING={sunset:26,dawn:8,rain:8,hillWalk:7,intro:4.5,lamps:3.2,fireworks:6,rainbow:60} as const;
export const SUNSET_RATE=48/TIMING.sunset;
export const greenRay={
 title:'海边的一页《绿光》',
 note:'灵感来自凡尔纳的小说《绿光》，以及侯麦的同名电影（1986）。',
 sources:[{label:'凡尔纳《绿光》第三章',url:'https://fr.wikisource.org/wiki/Le_Rayon_vert/Chapitre_III'},{label:'侯麦《绿光》· BFI',url:'https://www.bfi.org.uk/features/bfi-recommends-green-ray'}]
};

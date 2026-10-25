// Deterministic divination engine, shared by the server (which casts and
// interprets readings) and the client (which renders them).

export const HN=["","The Creative","The Receptive","Difficult Beginnings","Youthful Folly","Waiting","Conflict","The Army","Holding Together","Small Taming","Treading","Peace","Standstill","Fellowship","Great Possession","Modesty","Enthusiasm","Following","Work on the Corrupted","Approach","Contemplation","Biting Through","Grace","Splitting Apart","Return","Innocence","Great Taming","Nourishment","Great Excess","The Abysmal","The Clinging","Influence","Duration","Retreat","Great Power","Progress","Darkening of the Light","The Family","Opposition","Obstruction","Deliverance","Decrease","Increase","Breakthrough","Coming to Meet","Gathering","Ascending","Oppression","The Well","Revolution","The Cauldron","Thunder","Mountain","Gradual Progress","The Marrying Maiden","Abundance","The Wanderer","Wind","Joy","Dispersion","Limitation","Inner Truth","Small Excess","After Completion","Before Completion"];
export const HB=[63,0,17,34,23,58,2,16,55,59,7,56,61,47,4,8,25,38,3,48,41,37,32,1,57,39,33,30,18,45,28,14,60,15,40,5,53,43,20,10,35,49,31,62,24,6,26,22,29,46,9,36,52,11,13,44,54,27,50,19,51,12,21,42];
export const TD=["Fool","Magician","High Priestess","Empress","Emperor","Hierophant","Lovers","Chariot","Strength","Hermit","Wheel of Fortune","Justice","Hanged Man","Death","Temperance","Devil","Tower","Star","Moon","Sun","Judgement","The World","Ace of Wands","Two of Wands","Three of Wands","Four of Wands","Five of Wands","Six of Wands","Seven of Wands","Eight of Wands","Nine of Wands","Ten of Wands","Page of Wands","Knight of Wands","Queen of Wands","King of Wands","Ace of Cups","Two of Cups","Three of Cups","Four of Cups","Five of Cups","Six of Cups","Seven of Cups","Eight of Cups","Nine of Cups","Ten of Cups","Page of Cups","Knight of Cups","Queen of Cups","King of Cups","Ace of Swords","Two of Swords","Three of Swords","Four of Swords","Five of Swords","Six of Swords","Seven of Swords","Eight of Swords","Nine of Swords","Ten of Swords","Page of Swords","Knight of Swords","Queen of Swords","King of Swords","Ace of Pentacles","Two of Pentacles","Three of Pentacles","Four of Pentacles","Five of Pentacles","Six of Pentacles","Seven of Pentacles","Eight of Pentacles","Nine of Pentacles","Ten of Pentacles","Page of Pentacles","Knight of Pentacles","Queen of Pentacles","King of Pentacles"];
export const TP=["Who Am I?","What's Important?","What Do I Want?","What's In the Way?","How Do I Show Up?","What Do I Do?","What's the Next Step?"];

export const MAX_SEED = 2147483647;

export function isValidSeed(seed) {
  return Number.isInteger(seed) && seed > 0 && seed < MAX_SEED;
}

export function mkRNG(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() { s = s * 16807 % 2147483647; return (s-1)/2147483646; };
}

function flipBit(n, pos) {
  const bit = Math.pow(2, pos);
  return n % (bit*2) >= bit ? n - bit : n + bit;
}

export function divineReading(ts) {
  const b2h = {};
  HB.forEach(function(b,i){ b2h[b] = i+1; });
  const rng = mkRNG(ts);
  let pBin = 0;
  const changing = [], lines = [];
  for (let i=0; i<6; i++) {
    const sum = (rng()<0.5?2:3) + (rng()<0.5?2:3) + (rng()<0.5?2:3);
    lines.push(sum);
    if (sum===7||sum===9) pBin += Math.pow(2,i);
    if (sum===6||sum===9) changing.push(i+1);
  }
  const pH = b2h[pBin] || 1;
  let rBin = pBin;
  changing.forEach(function(l){ rBin = flipBit(rBin, l-1); });
  const rH = changing.length > 0 ? (b2h[rBin]||null) : null;
  const rng2 = mkRNG(ts + 1000003);
  const deck = Array.from({length:78}, function(_,i){ return i+1; });
  const cards = [];
  for (let i=0; i<7; i++) {
    const j = i + Math.floor(rng2() * (78-i));
    const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    cards.push({name: TD[deck[i]-1], pos: TP[i]});
  }
  return {ts, lines, pHex:pH, pName:HN[pH], changing, rHex:rH, rName:rH?HN[rH]:null, cards};
}

// One-line description of a reading, used to give the model context.
export function describeReading(r) {
  return "I Ching: Hexagram "+r.pHex+" ("+r.pName+")"+(r.rHex?" → "+r.rHex+" ("+r.rName+")":"")+
    (r.changing.length?", changing lines: "+r.changing.join(", "):"")+
    ". Tarot: "+r.cards.map(function(c){return c.pos+" "+c.name;}).join("; ");
}

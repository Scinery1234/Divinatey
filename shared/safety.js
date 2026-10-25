export const CRISIS_KW = ["suicide","suicidal","kill myself","end my life","want to die","self-harm","hurt myself","cut myself","overdose"];
export const detectCrisis = t => CRISIS_KW.some(k => t.toLowerCase().includes(k));
export const CRISIS_RES = [{name:"Lifeline",num:"13 11 14"},{name:"Beyond Blue",num:"1300 22 4636"},{name:"Emergency",num:"000"}];

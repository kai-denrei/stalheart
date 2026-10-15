// Every surveyed surface uses the same world-space front, emitted from ISAO.
export const SURVEY_SPEED=105;
export const surveyGLSL=`
  float surveyReturn(vec3 p){
    float r=distance(p,uScanOrigin),age=uTime-uScanTime-r/105.;
    float reached=smoothstep(-.018,0.,age)*step(r,170.);
    float ring=exp(-abs(age)*27.);
    return reached*(.74*exp(-max(0.,age)*.13)+ring*.14)*(1.-smoothstep(105.,178.,r));
  }
  vec3 surveyColor(float d,float mode,float moving){
    vec3 col=mix(vec3(.68,.70,.61),vec3(.34,.40,.37),smoothstep(5.,105.,d));
    if(mode>.5&&mode<1.5)col=vec3(.43,.58,.46);
    if(mode>1.5)col=mix(vec3(.30,.37,.33),vec3(.68,.66,.55),moving);
    return col;
  }
`;

import * as THREE from '../vendor/three.module.js';

const COL = {
  floor: 0x172f3c, steel: 0xadc9c4, steel2: 0x7caaa1, ivory: 0xd5e0d3,
  green: 0x377d65, yellow: 0xe2b64b, dark: 0x163b3b, rice: 0xd8b56c,
  teal: 0x62dfc3, blue: 0x266387, glass: 0x1c4055, red: 0xff736d,
};
const hex = n => '#' + n.toString(16).padStart(6, '0');

export class PlantScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.assetGroups = new Map();
    this.indicators = new Map();
    this.labels = [];
    this.particles = [];
    this.flowVisible = true;
    this.thermalVisible = false;
    this.selected = 3;
    this.siteStatus = 'healthy';
    this.scenario = 'normal';
    this.time = 0;
    this.camTheta = .81;
    this.camPhi = 1.03;
    this.camRadius = 25;
    this.target = new THREE.Vector3(0, 1.0, 0);
    this.desiredTarget = this.target.clone();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a202c');
    this.scene.fog = new THREE.FogExp2('#0a202c', .017);
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.38;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.initLights();
    this.buildPlant();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.installEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.updateStates();
    this.running = true;
    this.tick = this.tick.bind(this);
    this.tick();
  }

  mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, metalness: .27, roughness: .52, ...extra }); }
  box(group, pos, size, color, extra = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), typeof color === 'number' ? this.mat(color, extra) : color);
    mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  cylinder(group, pos, radiusTop, radiusBottom, height, color, segments = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), this.mat(color));
    mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  tube(group, pts, radius, color, transparent = false) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(20, pts.length * 12), radius, 8, false),
      this.mat(color, { metalness: .55, transparent, opacity: transparent ? .7 : 1 }));
    tube.castShadow = true; group.add(tube); return curve;
  }
  wire(group, points, color = COL.teal, opacity = .35) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    group.add(line); return line;
  }
  newAsset(id, x, z, labelY = 4.2) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.assetId = id;
    this.scene.add(group); this.assetGroups.set(id, group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .027, 6, 64),
      new THREE.MeshBasicMaterial({ color: COL.teal, transparent: true, opacity: .58 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .12; group.add(ring);
    this.indicators.set(id, ring);
    const label = this.makeLabel(String(id).padStart(2, '0'), COL.teal);
    label.position.set(0, labelY, 0); group.add(label); this.labels.push(label);
    return group;
  }
  makeLabel(text, color) {
    const c = document.createElement('canvas'); c.width = 200; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b2732ed'; ctx.strokeStyle = hex(color); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(22, 18, 156, 60, 13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dffff2'; ctx.font = 'bold 49px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 100, 49);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sprite.scale.set(.84, .41, 1); sprite.renderOrder = 10; return sprite;
  }
  initLights() {
    this.scene.add(new THREE.HemisphereLight(0xccefe8, 0x172a3b, 2.3));
    const dir = new THREE.DirectionalLight(0xffedcf, 2.7);
    dir.position.set(-9, 17, 7); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -18; dir.shadow.camera.right = 18; dir.shadow.camera.top = 16; dir.shadow.camera.bottom = -16;
    dir.shadow.bias = -.0006; dir.shadow.normalBias = .02; this.scene.add(dir);
    const fill = new THREE.PointLight(0x5ce8cb, 16, 25); fill.position.set(8, 8, -5); this.scene.add(fill);
  }
  buildPlant() {
    const base = new THREE.Group(); this.scene.add(base);
    this.box(base, [0,-.17,0], [15,.32,10], COL.floor, { metalness: .35, roughness: .77 });
    this.box(base, [0,.005,0], [14.8,.015,9.8], 0x173946, { metalness: .33, roughness: .8 });
    // CAD-style floor grid, site boundary, numbered lanes and edge light.
    const grid = new THREE.GridHelper(14.9, 30, 0x286375, 0x286375); grid.position.y=.02;
    grid.material.transparent=true; grid.material.opacity=.35; base.add(grid);
    const perimeter=[[-7.45,.02,-4.95],[7.45,.02,-4.95],[7.45,.02,4.95],[-7.45,.02,4.95],[-7.45,.02,-4.95]];
    this.wire(base, perimeter, COL.teal, .72);
    for (const x of [-6,-3,0,3,6]) {
      const tick = this.box(base,[x,.025,4.96],[.11,.015,.16],0x54bfae); tick.castShadow=false;
    }
    // 01: Receiving hopper, grated opening and pile of grain.
    {
      const g=this.newAsset(1,-6.05,2.0,2.8);
      this.box(g,[0,.76,0],[2.15,.8,1.45],COL.green);
      this.box(g,[0,1.18,0],[2.27,.09,1.54],COL.steel2);
      const grain=this.cylinder(g,[0,1.19,0],.66,.8,.07,COL.rice,8); grain.rotation.y=.19;
      for(let x=-.9;x<=.9;x+=.25) this.box(g,[x,1.255,0],[.018,.02,1.47],0x7b9d96);
      for(let z=-.62;z<=.62;z+=.22) this.box(g,[0,1.26,z],[2.13,.02,.018],0x799d96);
      for(let x of [-.8,.8])for(let z of [-.5,.5]) this.box(g,[x,.22,z],[.12,.5,.12],COL.steel2);
      this.box(g,[.95,.63,0],[.25,.34,.62],COL.yellow);
    }
    // 02: bucket elevator and pre-cleaning vibrating sieve.
    {
      const g=this.newAsset(2,-4.35,1.0,5.5);
      this.box(g,[-.65,2.57,0],[.71,4.95,.72],COL.ivory);
      this.cylinder(g,[-.65,5.1,0],.4,.4,.46,COL.green);
      for(let y=1.1;y<4.8;y+=.9) this.box(g,[-.28,y,.375],[.08,.07,.08],COL.steel2);
      this.box(g,[.65,1.10,.5],[2.15,.3,1.10],COL.yellow);
      this.box(g,[.68,.77,.5],[1.8,.4,.75],COL.steel2);
      for(let x of [-.15,1.45])for(let z of [.1,.9]) this.box(g,[x,.47,z],[.075,.85,.075],COL.yellow);
      this.box(g,[.47,1.35,.4],[.57,.31,.59],COL.ivory);
      this.box(g,[-.95,.65,0],[.7,.45,.8],COL.green);
      this.tube(g,[[-.65,4.88,.1],[-.2,4.7,.2],[.7,3.4,.25],[.8,1.5,.42]],.09,COL.steel);
    }
    // 03: drying column, heat exchanger, biomass furnace and air ducts.
    {
      const g=this.newAsset(3,-1.55,-.05,5.8);
      this.box(g,[0,2.4,0],[1.9,4.5,1.8],COL.ivory);
      this.box(g,[0,4.72,0],[2.03,.20,1.95],COL.steel);
      for(let y=.8;y<4.5;y+=.61) this.box(g,[-.955,y,0],[.035,.035,1.45],COL.steel2);
      for(let x=-.56;x<=.56;x+=.37) this.box(g,[x,3.05,.92],[.19,1.7,.035],0xb5cfc7);
      this.box(g,[.10,1.35,1.35],[1.30,1.4,1.12],COL.green);
      this.cylinder(g,[.22,.62,1.56],.6,.6,.78,COL.green,16);
      this.box(g,[.15,1.30,1.94],[.65,.42,.08],COL.dark);
      this.box(g,[.02,.3,2.15],[.55,.44,.54],COL.yellow);
      this.tube(g,[[.26,1.7,1.47],[.3,2.0,1.48],[.45,2.65,.84],[.45,3.3,.65]],.14,COL.steel);
      this.box(g,[-.95,.47,-.18],[.42,.6,.58],COL.yellow);
      this.box(g,[.82,.46,-.15],[.38,.56,.6],COL.yellow);
      this.box(g,[.3,2.45,-.93],[.49,.30,.08],0x395c59);
      this.thermalCloud=new THREE.Mesh(new THREE.SphereGeometry(.9,20,12),
        new THREE.MeshBasicMaterial({ color:0xff7045,transparent:true,opacity:.12,depthWrite:false }));
      this.thermalCloud.position.set(0,2.6,0); this.thermalCloud.scale.set(1.4,2.6,1.2);g.add(this.thermalCloud);
    }
    // 04: three elevated storage silos (20 t each), in/out transfer and legs.
    {
      const g=this.newAsset(4,2.15,-1.4,5.6);
      for(let i=0;i<3;i++){
        const x=(i-1)*1.25;
        this.cylinder(g,[x,2.65,0],.56,.56,2.15,COL.ivory,12);
        const cone=new THREE.Mesh(new THREE.ConeGeometry(.61,1.03,12),this.mat(COL.steel));
        cone.rotation.z=Math.PI;cone.position.set(x,1.15,0);cone.castShadow=true;g.add(cone);
        this.cylinder(g,[x,3.81,0],.57,.57,.26,COL.green,12);
        for(let dx of [-.41,.41])for(let dz of [-.39,.39]) this.box(g,[x+dx,.65,dz],[.065,1.05,.065],COL.green);
        this.box(g,[x,.4,0],[.12,.43,.13],COL.yellow);
        this.box(g,[x,3.42,.57],[.5,.27,.03],0x819d97);
      }
      this.box(g,[0,4.16,0],[3.64,.13,.38],COL.steel2);
      this.box(g,[0,4.3,0],[3.65,.16,.26],COL.green);
      for(let x of [-1.0,0,1.0]) this.box(g,[x,4.05,0],[.08,.3,.52],COL.yellow);
    }
    // 05: seed sorter/ grader, vibration chute and framing.
    {
      const g=this.newAsset(5,4.25,1.4,3.35);
      this.box(g,[0,1.2,0],[1.9,.43,.85],COL.green);
      this.box(g,[-.8,1.45,0],[.7,.45,.8],COL.yellow);
      this.box(g,[.2,1.51,-.03],[1.5,.09,.78],COL.steel2);
      for(let x of [-.7,.7])for(let z of [-.35,.35]) this.box(g,[x,.58,z],[.075,1.15,.075],COL.steel);
      this.cylinder(g,[.84,1.24,0],.37,.37,.43,COL.steel2);
      this.box(g,[.86,.88,.05],[.2,.5,.34],COL.yellow);
      this.box(g,[-.85,.8,.15],[.52,.28,.44],COL.yellow);
    }
    // 06: power/control cabinet, status LEDs, compact display.
    {
      const g=this.newAsset(6,6.13,-2.7,2.95);
      this.box(g,[0,1.2,0],[1.1,2.35,.74],COL.ivory);
      this.box(g,[0,1.41,.38],[.66,.45,.05],COL.dark);
      for(let i=0;i<3;i++)this.cylinder(g,[-.29+i*.29,.94,.39],.07,.07,.06,i===0?COL.teal:i===1?COL.yellow:COL.red,10).rotation.x=Math.PI/2;
      this.box(g,[-.34,.25,.36],[.17,.08,.08],COL.steel2);
      this.box(g,[.34,.25,.36],[.17,.08,.08],COL.steel2);
    }
    // 07: bagging unit with spout, hopper and filled bag.
    {
      const g=this.newAsset(7,6.0,1.45,3.75);
      this.box(g,[0,1.76,0],[1.12,2.82,1.05],COL.ivory);
      this.box(g,[0,2.26,.55],[.65,.44,.07],COL.dark);
      this.box(g,[-.02,1.4,.56],[.78,.67,.58],COL.green);
      this.box(g,[0,.90,.78],[.41,.27,.37],COL.yellow);
      this.box(g,[0,.38,1.10],[.43,.57,.42],0xc8bb8d);
      this.box(g,[.42,1.78,.59],[.17,.27,.06],COL.steel2);
      this.cylinder(g,[.42,1.86,.65],.045,.045,.05,COL.red,12).rotation.x=Math.PI/2;
    }
    // 08: stylized solar canopy (illustrative array; capacity unspecified in supplied BOQ).
    {
      const g=this.newAsset(8,-3.9,-3.47,2.65);
      for(let row=0;row<2;row++){
        for(let col=0;col<3;col++){
          const panel=this.box(g,[col*1.65,.95,row*.85],[1.5,.06,.74],0x173f62,{metalness:.55,roughness:.26});
          panel.rotation.x=-.20;
          const cellMat=this.mat(0x267492,{metalness:.55,roughness:.24});
          for(let x=-.5;x<=.5;x+=.35)for(let z=-.22;z<=.22;z+=.22){
            const cell=this.box(g,[col*1.65+x,1.005+z*.21,row*.85+z],[.29,.015,.18],cellMat);cell.rotation.x=-.20;
          }
          for(let dx of [-.54,.54]) this.box(g,[col*1.65+dx,.45,row*.85],[.046,.92,.046],COL.steel2);
        }
      }
      this.box(g,[4.2,.43,.6],[.42,.83,.43],COL.ivory);
    }

    // Connections are conceptual conveyors, not as-built piping.
    const connections=new THREE.Group();this.scene.add(connections);
    const tracks=[
      { points:[[-5.1,1.35,1.7],[-4.6,2.0,1.45],[-4.65,4.7,1.05],[-3.55,1.35,1.6]], color:0xefc75e },
      { points:[[-3.2,1.45,1.35],[-2.75,2.6,1.1],[-2.55,3.8,.75],[-2.35,3.9,.45]], color:0x79e0cc },
      { points:[[-.55,4.1,-.25],[.05,4.7,-.6],[1.15,4.6,-1.4],[2.1,4.36,-1.4]], color:0x7ae6c8 },
      { points:[[3.55,1.5,-1.35],[3.7,1.5,-.2],[4.2,1.52,.72],[4.4,1.55,1.15]], color:0x7ae6c8 },
      { points:[[5.07,1.45,1.45],[5.35,1.45,1.45],[5.7,1.3,1.5],[5.95,1.18,1.7]], color:0xc4f39b },
    ];
    for(const entry of tracks){
      const curve=this.tube(connections,entry.points,.055,entry.color,true);
      for(let i=0;i<7;i++){
        const dot=new THREE.Mesh(new THREE.SphereGeometry(.08,8,8),new THREE.MeshBasicMaterial({color:entry.color}));
        connections.add(dot);this.particles.push({mesh:dot,curve,t:i/7,speed:.11+Math.random()*.08});
      }
    }
    this.flowGroup=connections;
    this.floorLines=new THREE.Group();this.scene.add(this.floorLines);
    this.wire(this.floorLines,[[-6.05,.035,3.6],[-4.4,.035,3.6],[-1.55,.035,3.6],[2.15,.035,3.6],[4.25,.035,3.6],[6.0,.035,3.6]],COL.yellow,.38);
    for(const x of [-6.05,-4.4,-1.55,2.15,4.25,6])this.box(this.floorLines,[x,.04,3.6],[.08,.03,.18],COL.yellow).castShadow=false;
  }

  updateStates(){
    for(const [id,ring] of this.indicators){
      const critical = (id === 3 && this.scenario === 'alarm') || (this.siteStatus === 'critical' && id === 3);
      const warn = (this.siteStatus === 'warning' && id === 2) || (this.scenario === 'wet' && id === 3);
      const offline=this.siteStatus==='offline';
      ring.material.color.setHex(critical?COL.red:warn?COL.yellow:offline?0x74828a:COL.teal);
      ring.material.opacity=id===this.selected?.9:.52;
      ring.scale.setScalar(id===this.selected?1.2:1);
    }
    this.thermalCloud.visible=this.thermalVisible;
    this.thermalCloud.material.color.setHex(this.scenario==='alarm'?0xff4538:0xffaa55);
    this.thermalCloud.material.opacity=this.scenario==='alarm'?.34:.12;
  }
  selectAsset(id, moveCamera=true){
    if(!this.assetGroups.has(id))return;
    this.selected=id;this.updateStates();
    if(moveCamera){
      const g=this.assetGroups.get(id);
      this.desiredTarget.set(g.position.x*.35,.95,g.position.z*.35);
    }
    this.onSelect?.(id);
  }
  setSiteStatus(status){this.siteStatus=status;this.updateStates()}
  setScenario(scenario){this.scenario=scenario;this.updateStates()}
  setFlowVisible(on){this.flowVisible=on;this.flowGroup.visible=on}
  setThermalVisible(on){this.thermalVisible=on;this.updateStates()}
  resetCamera(){this.camTheta=.81;this.camPhi=1.03;this.camRadius=25;this.desiredTarget.set(0,1.0,0)}
  resize(){
    const width=Math.max(1,this.canvas.parentElement.clientWidth),height=Math.max(1,this.canvas.parentElement.clientHeight);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);
  }
  installEvents(){
    const canvas=this.canvas;let down=null;
    const normalized=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1}};
    const hitTest=e=>{
      const p=normalized(e);this.pointer.set(p.x,p.y);this.raycaster.setFromCamera(this.pointer,this.camera);
      const hits=this.raycaster.intersectObjects([...this.assetGroups.values()],true);
      for(const hit of hits){let o=hit.object;while(o && !o.userData.assetId)o=o.parent;if(o?.userData.assetId)return o.userData.assetId}
      return null;
    };
    canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,travel:0,dragged:false};canvas.setPointerCapture?.(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{
      if(down){const dx=e.clientX-down.x,dy=e.clientY-down.y;down.travel+=Math.hypot(dx,dy);if(down.travel>4)down.dragged=true;this.camTheta-=dx*.007;this.camPhi=Math.max(.25,Math.min(1.45,this.camPhi+dy*.006));down.x=e.clientX;down.y=e.clientY;}
      else canvas.style.cursor=hitTest(e)?'pointer':'grab';
    });
    canvas.addEventListener('pointerup',e=>{if(!down)return;const wasDrag=down.dragged;down=null;if(!wasDrag){const id=hitTest(e);if(id)this.selectAsset(id)}});
    canvas.addEventListener('pointercancel',()=>{down=null});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.camRadius=Math.max(11,Math.min(42,this.camRadius+e.deltaY*.015))},{passive:false});
    canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')this.camTheta-=.1;else if(e.key==='ArrowRight')this.camTheta+=.1;else if(e.key==='ArrowUp')this.camPhi=Math.max(.25,this.camPhi-.07);else if(e.key==='ArrowDown')this.camPhi=Math.min(1.45,this.camPhi+.07);else return;e.preventDefault()});
  }
  tick(){
    if(!this.running)return;
    requestAnimationFrame(this.tick);
    this.time+=.016;
    this.target.lerp(this.desiredTarget,.06);
    this.camera.position.set(this.target.x+Math.sin(this.camTheta)*Math.sin(this.camPhi)*this.camRadius,
      this.target.y+Math.cos(this.camPhi)*this.camRadius,
      this.target.z+Math.cos(this.camTheta)*Math.sin(this.camPhi)*this.camRadius);
    this.camera.lookAt(this.target);
    if(this.flowVisible)for(const p of this.particles){p.t=(p.t+p.speed*.016)%1;p.mesh.position.copy(p.curve.getPointAt(p.t));}
    for(const [id,ring] of this.indicators){ring.material.opacity=(id===this.selected?.80:.45)+Math.sin(this.time*2.5+id)*.07;ring.rotation.z+=.0015;}
    if(this.thermalCloud.visible)this.thermalCloud.scale.y=2.6+Math.sin(this.time*1.3)*.2;
    this.renderer.render(this.scene,this.camera);
  }
  destroy(){this.running=false;this.resizeObserver.disconnect();this.renderer.dispose();}
}

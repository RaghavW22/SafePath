const pts = new Map();
for(let i=0; i<5; i++) {
        const y = 112 + i*74;
        pts.set(`L${i}`, { x: 45, y, neighbors: [`HL${i}`] });
        pts.set(`R${i}`, { x: 855, y, neighbors: [`HR${i}`] });
        pts.set(`HL${i}`, { x: 90, y, neighbors: [`L${i}`] });
        pts.set(`HR${i}`, { x: 810, y, neighbors: [`R${i}`] });
        if(i > 0) {
            pts.get(`HL${i}`).neighbors.push(`HL${i-1}`);
            pts.get(`HL${i-1}`).neighbors.push(`HL${i}`);
            pts.get(`HR${i}`).neighbors.push(`HR${i-1}`);
            pts.get(`HR${i-1}`).neighbors.push(`HR${i}`);
        }
    }
    pts.set('HTL', { x: 90, y: 63, neighbors: ['HL0', 'HTR', 'EXA'] });
    pts.set('HTR', { x: 810, y: 63, neighbors: ['HR0', 'HTL', 'EXB'] });
    pts.set('HBL', { x: 90, y: 459, neighbors: ['HL4', 'HBR', 'EXC'] });
    pts.set('HBR', { x: 810, y: 459, neighbors: ['HR4', 'HBL', 'EXD'] });
    
    pts.get('HL0').neighbors.push('HTL');
    pts.get('HR0').neighbors.push('HTR');
    pts.get('HL4').neighbors.push('HBL');
    pts.get('HR4').neighbors.push('HBR');

    pts.set('EXA', { x: 125, y: 25, neighbors: ['HTL'] });
    pts.set('EXB', { x: 775, y: 25, neighbors: ['HTR'] });
    pts.set('EXC', { x: 125, y: 516, neighbors: ['HBL'] });
    pts.set('EXD', { x: 775, y: 516, neighbors: ['HBR'] });

const startNode = 'R3';
const GOALS = ['EXA', 'EXB', 'EXC', 'EXD'];
const open = [startNode];
const cameFrom = new Map();
const gScore = new Map();
for(const key of pts.keys()) gScore.set(key, Infinity);
gScore.set(startNode, 0);

while(open.length > 0) {
    open.sort((a,b) => gScore.get(b) - gScore.get(a));
    const curr = open.pop();
    if(GOALS.includes(curr)) {
        let path = []; let c = curr;
        while(c) { path.unshift(c); c = cameFrom.get(c); }
        console.log('PATH FOUND:', path);
        process.exit();
    }
    for(const nbr of pts.get(curr).neighbors) {
        const d = Math.hypot(pts.get(curr).x - pts.get(nbr).x, pts.get(curr).y - pts.get(nbr).y);
        const tg = gScore.get(curr) + d;
        if(tg < gScore.get(nbr)) {
            cameFrom.set(nbr, curr);
            gScore.set(nbr, tg);
            if(!open.includes(nbr)) open.push(nbr);
        }
    }
}
                    
console.log('NO PATH');

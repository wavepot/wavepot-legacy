/**
 * wavepot <3
 *
 * -=- work in progress ;) -=-
 *
 * we are using cutting edge technologies!
 * for it to work, you need to type in the url chrome://flags
 * and enable "Experimental Web Platform features",
 * "Experimental JavaScript", "Future VM features" and
 * "WebAssembly threads support".
 * this will hopefully not be needed in the near future
 * when Chrome releases these into the stable channel
 *
 * uncomment things and edit values below to begin playing
 * ctrl+s saves and plays - ctrl+enter stops
 * go on! hit ctrl+s now!
 * visuals are dwitter.net dweets, copy&paste should work
 * changes are saved locally and preserved in browser cache
 * clear cache or ctrl+z to get back to this initial setup here
 * btw, this is not a sandbox! code below is executed natively
 * in a browser worker - imports work and you can fetch things
 * proper saving and lots more coming up in the near future
 * follow the development here https://github.com/wavepot/wavepot/tree/v3
 * share the love and keep scripting <3
 *
 * enjoy :^)
 */

import clip from './lib/softclip/index.js'
import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { saw, sin } from './lib/osc/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import note from './lib/note/index.js'
import Nopop from './lib/nopop/index.js'
import arp from './lib/arp.js'
import perc from './lib/perc.js'
import slide from './lib/slide.js'
import { scales } from './lib/scales/index.js'
import { dsp as Beats } from './drumbeats.js'
import Delay from './lib/delay/index.js'
import Diode from './lib/diodefilter/index.js'
import Biquad from './lib/biquad/index.js'
import { beatFrames, blockFrames } from './settings.js'
import rand from './lib/seedable-random.js'

export default async () => {
  rand.seed(696)

  var nopop = Nopop(.07,.001)

  var notes = scales['minor blues']
    .map(n => n + (2 + (rand()*5|0) * 12))

  var notesHz = notes.map(note)

  var chorder = await Chorder({
    notes: notes.map(n => n/2 + (rand()*2|0)*12), reverse: false,
    osc: Tri, params: [15, false],
    octave: 3, speed: 2
  })
  // var chorder2 = await Chorder({ scale: 'mixolydian', reverse: true, osc: Saw, octave: 1, speed: 8, notes: 1 })
  var lpf = Moog('half')
  var lfo = Sin()

  var diode = new Diode()
  var delay = new Delay(blockFrames)
  var biquad1 = new Biquad('hpf')
  var biquad2 = new Biquad('bpf')
  var biquad3 = new Biquad('lpf')

  var bassOsc = Saw(255)
  // var bassOsc = Sqr(50)

  var sd = 1111
  var beats1 = await Beats({ seed: sd, images: [
    // [sd+3,'base',4,0,.4],
    [sd+123,'base',8,0,.6],
    // [114011,'base',4,0,.6],
    // [123,'base',4,0,.4],
    // [333,'base',4,0,1],
    // [88,'base',4,0,2.5],

    // [333,'highs',4,0,.7],
    // [111,'highs',4,0,.7],
    // [222,'highs',4,0,.56],
    [222101,'highs',2,0,2],

    // [101010,'snare',1,0,2],
    // [666,'snare',4,0,1],
    // [333,'snare',1,0,1.7],
    // [77777,'snare',1,0,1.7],

    // [445,'texture',2,0,.7],
    // [222,'texture',2,0,.7],
    // [666,'texture',4,0,2],

    // [223,'snare',4,.2,.7],
    // [sd+44423,'snare',1,0,.7],
    // [222,'snare',1,0,1.7],
    // [555,'snare',1,0,1.2],
    // [55555,'snare',1,0,1.2],

    // [333,'tonal',4,0,.6],
    // [444,'tonal',4,0,.4],
    [7777,'tonal',2,0,3], //!!
  ] })


  return (t, f) => {
    // t*=1.02;f*=1.02
    var kick = arp(t, 1/4, 52, 50, 8)

    var keys = chorder(t)
    keys = lpf
      .cut(1800 + perc(t%(1/16), 100, 30) + -lfo(1)*200)
      .res(0.55)
      .sat(0.8)
      .update().run(keys)
    keys = perc(t/4%(1/2), 2, keys)
    keys = keys + biquad1.cut(300).res(3).gain(3).update().run(keys)

    var bass = bassOsc(slide(t/2, 1/16, 3, notesHz.map(n => n/2)))
    bass = bass * perc(t%(1/4),40,25) * .17
    bass = diode
      .cut(1.35 *
       perc((t+(1/2))%(3.5),
       .07,.013) // magic
     + sin(t, 4)*.004 // magic
     + (sin(t, .01)+1) *.10
     + (sin(t, 4)+1) *.05
       )
      .hpf(.00028)
      .res(.92)
      .run(bass*2) //* //perc(t%(1/4),2,30) * .52

    bass = clip(bass, .62) // more magic
    var out = (0
      + clip(kick * 2.5, .5)*.3
      + .25 * keys
      + 0.25 * bass
      + .14 * beats1(t, f % blockFrames)
    )

    // eq
    out = out - biquad2.cut(200).res(3).gain(3).update().run(out)*.4
    out = out - biquad3.cut(300).res(2).gain(3).update().run(out)*.6

    return (
      nopop(out*.25)
      // delay.feedback(.69).delay(beatFrames/200).run(out, 0.5) * .5
    )
  }
}

export var draw = t => {
  // dna
  // for(i=0;i<1100;i++){d=C(t+1*i),s=i==0?2920:9-d*20;x.fillStyle=R(i,i,i,0.1);x.fillRect(S(t*2.5+3*i)*280*S(C(t)+i%50)+960*(i==0?-1:1),i,s,s);};x.fillStyle='transparent'

  // fire
  // x.fillRect(0,0,b=2e3,b);for(d=i=999;i--;x.fillRect(e=i%40*50+99*S(i/t)-99,(a=(i*i-t*(99+i%60))%d),a*a/b,50))x.fillStyle=R(i%255,i%150,0,.01)

  // spin disc
  // x.fillStyle='white';for(i=0;i<300;i++)for(j=0;j<6;j++){x.fillRect(960+200*C(i)*S(T(t/1.1)+j/i),540+200*S(i),10,10)};x.fillStyle='transparent'

  // spins
  // x.strokeStyle='#fff';for(i=3;i++<11;)a=i*S(t)/4,x.beginPath(),x.arc(960,540,40*i,Math.min(t+a,t+3*a),Math.max(t+a,t+3*a)),x.lineWidth=i*i/5,x.stroke()

  // psychedelic
  // for(i=(j=99)*11;i--;x.fillStyle=R(t*i/2%j*2,t*i/4*1%j,t*i/2%j,.1))x.fillRect(909+i*C(i+t),500+i*S(i+t),j,j)

  // psy waves paint zoom
  // a=(b,e=128)=>S(t*b/3)*e+e;x.fillStyle=R(a(7),a(3),a(2)+128,1);x.fillRect(a(5,960),a(10,540),50,50);x.drawImage(c,S(t)-.5,C(t)-.5,1922,1082)

  // more psy
  // for(i=0;i<100;i++){x.fillStyle=`hsla(${i},10%,50%,.5)`;x.fillRect(950+C(t+2*i)*T(t+i*2)*500,550+S(t+i*2)*T(t+i*414)*400,40,40)};

  // stars
  // x.fillStyle='black';
  // x.fillRect(0,0,i=w=c.width,w);x.fillStyle="rgba(255,255,255,1)";for(;i--;)j=t*99,z=w*99/(i-j%1),a=i+j-j%1,x.fillRect(C(a*a)*z+1e3,C(a*w)*z+500,w/i,w/i);x.fillStyle='transparent'

  // weird rope
  // x.fillStyle='black';x.fillRect(0,0,1920,1080);
  // x.fillStyle='#fff';for(X=i=0;i++<1e3;x.fillRect(960+950*X,540+530*Y,9,9))Y=X,X=S(X+S(i)-t);

  // weird dots
  // x.fillStyle='black';x.fillRect(0,0,1920,1080);
  // x.fillStyle='#fff'
  // for(j=i=0;i++<1e2;x.fillRect(955+955*j,535+535*k,10,10))k=j,j=S(j+S(i)*(1e9+t/2));x.fillStyle='black';

  // rain
  // h=344
  // x.fillStyle='black';x.fillRect(0,0,1920,1080);
  // x.fillStyle='#0f0'
  // for(z=1e4;z--;x.fillRect(~~a*w*C(z)+i**3%h*5,(a*h-~~a*w)*(2+i%.9)+w*S(z)/4,3,3))a=(t/2+C(i=z%99))%2,w=a*h-h

//   // carousel
  // x.fillStyle='black';x.fillRect(0,0,1920,1080);
  // x.fillStyle='rgba(255,255,255,1)'
  // for(i=2e3;i--;)x.fillRect(880+560*S(d=i/92)*S(b=2.79*i+t),270+160*(C(d)+T(t/9+d)),s=7/(S(d)*C(b)+2),s)

//   // banana
  // x.fillStyle='yellow'
  // for(i=d=1920;j=i--/d;x.fillStyle=R(d+i,d/j,x.arc(99+(i-79)*S(T(t)),S(3*j+S(t*7)/3)*705,j>.9?5:200*S(3*j+.3),0,7),x.fill()))x.beginPath()

  // reflection
  // x.fillRect(C(t/5)*960+960,S(t)*270+270,9,9)
  // x.clearRect(0,h=540,2e3,h)
  // for(i=544;i-=8;)x.drawImage(c,0,h-i,2e3,8,0,h+i*(S(i+t)/9+1),2e3,8)

  // chess
  // x.fillStyle='red'
  // for(i=0;i<23;i++)g=250*((5*t+i|0)%2),x.fillStyle=R(g,0,0,1),x.fillRect(80*i,5,80,20);x.drawImage(c,-5,5,1930,1080+5*S(t));

  // kaleido
  x.clearRect(0,0,1920,1080)
  x.fillStyle='rgba(255,255,255,.23)'
  f=(u,v,a,s,i)=>{for(i=11;s>29?i--:x.fillRect(u,v,4,4);f(u+S(b=i+i/21-a)*(q=s+s*S(b*6)**99),v+C(b)*q,b*2,s/2));}
  f(960,540,t/20,400)

  // kaleido 2
  // x.clearRect(0,0,1920,1080)
  // x.fillStyle='rgba(255,255,255,.23)'
  // f=(u,v,a,s,i=6)=>s<9?x.fillRect(u,v,9,9):i&&f(u+S(b=a+i*Math.PI/3)*s,v+C(b)*s,b*-2,s/2)|f(u,v,a,s,i-1)
  // f(960,540,t*S(t/9),270)

  // kaleido 3
  // x.clearRect(0,0,1920,1080)
  // x.fillStyle='rgba(255,255,255,1)'
  // f=(u,v,a,s,i=3)=>s<9?x.lineTo(u,v):i&&f(u+S(b=a+i*Math.PI/3*2)*s,v+C(b)*s,b*-2,s/5*3)|f(u,v,a,s,i-1)
  // f(960,540,t/9,270)
  // x.fill()

  // sphere
  // x.clearRect(0,0,1920,1080)
  // x.fillStyle='rgba(255,255,255,1)'
  // for(i=1920;x.beginPath(),i--;x.fill())x.arc(960+(i*960-i*i)**.5*S(a=t-i),48+i,9*(C(a)*S(i/306))**.3,0,7)

  // weird lines
  // x.clearRect(0,0,1920,1080)
  // for(i=0;i++<100;){x.fillRect(i*30-350,600+C(1e14*t+(i))*300,500,50);x.fillStyle=R(T(t/5)*100,C(i/5)*100,S(t/6)*100)}

  // psy hole
  // x.fillStyle=`hsl(${t*=350},90%,${t%99}%`,x.beginPath(x.fill()),x.arc(960,540,5,0,7),X=S(t*=6)*5,Y=C(t/2)*5,x.drawImage(c,X-80,Y-45,2080+X,1170+Y)

  // weirdness - use in conjunction
  // for(i=6;i--;x.stroke()&x.drawImage(c,x.globalAlpha=.1,i))x.lineTo(99+S(t+=(7-i)%2/.64)*99/(Z=(t<6)+1+C(t)),49+((i%4/2<<6)-25)/Z)
  // x.globalAlpha=1

  // chaos
  // x.clearRect(0,0,1920,1080);x.fillStyle='#fff';
  // Y=0;for(X=2e3;X--;)Y=C(Y+t)*X/450,x.fillRect(X,540+Y*120,5,5)

  // tunnel
  // x.clearRect(0,0,1920,1080);x.fillStyle='#fff';
  // x.strokeStyle='#fff';
  // for(i=9;i<2e3;i+=2)s=3/(9.1-(t+i/99)%9),x.beginPath(),j=i*7+S(i*4+t+S(t)),x.lineWidth=s*s/5,x.arc(960,540,s*49,j,j+.6),x.stroke()

  // tunnel 2
  // x.clearRect(0,0,1920,1080);
  // x.strokeStyle='rgba(255,255,255,.2)';
  // n=900;for(i=9;i<n;i+=3)s=2/(9.1-(t/4+i/99)%9),x.beginPath(),x.lineWidth=s*s,x.arc(n,240*(1+s)/s,s*99,j=i*9,j+6),x.stroke()

  // cool
  // x.clearRect(0,0,1920,1080);
  // x.fillStyle='#fff';
  // w=1920;g=s=>0.5+S(t*s)/2;b=`C${'🤓'.repeat(g(5)*40+2)}L`;x.font=g(5)*99+99+'px s';x.fillText(b,g(2)*(w-x.measureText(b).width),480)

  // spiral
  // A=960,B=540,x.clearRect(0,0,D=2e3,D);x.fillStyle='#f0f';
  // for(i=D;i--;)x.fillRect(A+1/(Z=2.5+C(p=i*C(t/2)/40)*S(q=i/628))*(X=S(p)*S(q))*A,B+C(q)/Z*A,s=69/Z/Z,s)

  // psy spiral
  // x.clearRect(0,0,1920,1080)
  // for(i=32;i-->2;)x.fillStyle=`hsl(${i*t*9},150%,50%)`,x.lineWidth=i*2,x.beginPath(x.arc(960+C(a=t*i/3)*i,540+S(a)*i,i*i/2,0,7),x.fill(x.stroke()))

  // psy spread
  // for(i=32;i-->0;)x.fillStyle=`hsla(${99*t+i*9},70%,30%,.2)`,x.beginPath(x.arc(S(t)*960+960+C(t)*i,540,i*(1+S(t)*C(t))*16,0,7),x.fill())

  // spiral tunnel
  // x.clearRect(0,0,1920,1080);
  // x.fillStyle=R(b=2e3,b,b,0.01);
  // x.strokeStyle='rgba(255,0,0,1)';
  // x.fillRect(0,0,b,b);x.beginPath();for(i=b*.2;i--;)x.lineTo(i/2*C(t)+i*S(g=t+i)+960,i/4*S(t)+i*C(g)+540);x.stroke()
}

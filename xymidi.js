var XYContainer = document.createElement('div');
XYContainer.className = 'xy-container';

var XYRowA = document.createElement('div')
XYRowA.className = 'xy-row'
XYContainer.appendChild(XYRowA)

var XYRowB = document.createElement('div')
XYRowB.className = 'xy-row'
XYContainer.appendChild(XYRowB)

XYContainer.ontouchstart =
XYContainer.ontouchenter =
XYContainer.ontouchmove =
XYContainer.onmousemove = e => {
  e.stopPropagation();
  e.preventDefault();

  if (!e.touches) {
    e.touches = [e];
  }

  for (var i = 0; i < e.touches.length; i++) {
    var touch = e.touches[i];
    for (var j = 0; j < XYs.length; j++) {
      var xy = XYs[j];
      // if (xy.active === false) continue;
      if ( touch.clientX > xy.pos.left && touch.clientX < xy.pos.left + xy.pos.width
        && touch.clientY > xy.pos.top && touch.clientY < xy.pos.top + xy.pos.height
        ) {
        Object.assign(xy.spot.style, {
          left: touch.clientX - xy.pos.left + 'px',
          top: touch.clientY - xy.pos.top + 'px'
        });
      }
    }
  }
};

function createXYController(n) {
  var xy = {};

  var el = document.createElement('div');
  el.className = 'xy-controller xy-' + n;

  var spot = document.createElement('div');
  spot.className = 'xy-spot';

  el.appendChild(spot);
  var center = document.createElement('span');
  el.appendChild(center);

  el.ontouchleave = e => {
    xy.active = false;
  };

  document.body.addEventListener('mouseup', el.ontouchleave);

  el.onmousedown = e => {
    xy.active = true;
  };

  xy.el = el;
  xy.spot = spot;

  return xy;
}

var XYs = ['a','b','c','d'].map(createXYController)
XYs.slice(0,2).forEach(xy => XYRowA.appendChild(xy.el));
XYs.slice(2,4).forEach(xy => XYRowB.appendChild(xy.el));

container.appendChild(XYContainer);

function getXYPositions() {
  XYs.forEach(xy => xy.pos = xy.el.getBoundingClientRect());
}

getXYPositions()

window.onresize = getXYPositions

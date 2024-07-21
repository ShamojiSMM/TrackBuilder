var canvases = [grid, rails, select, listener];

var gridCtx = grid.getContext("2d");
var railsCtx = rails.getContext("2d");
var selectCtx = select.getContext("2d");

var gridNum = 18;
var cellSize = 22;
var canvasSize = gridNum * cellSize;

document.oncontextmenu = () => { return false; }

canvasWrapper.style.height = `${canvasSize}px`;
canvases.forEach(canvas => {
  canvas.width = canvasSize;
  canvas.height = canvasSize;
});

gridCtx.strokeStyle = "rgba(200, 200, 200, .35)";
selectCtx.fillStyle = "rgba(96, 114, 247, 0.3)";
grid.style.backgroundColor = "#000";
var selectedButtonModeColor = "#9effba";
var markButtonFeatureColor = "#b3cfff";

railsCtx.imageSmoothingEnabled = false;

var railCells;

function resetRailCells() {
  railCells = [];

  for (var y = 0; y < gridNum; y ++) {
    railCells.push([]);

    for (var x = 0; x < gridNum; x ++) {
      railCells[y].push(
        {part: "", dir: "", type: "", connections: []}
      );
    }
  }
}

var lastRails;
var lastRailCells;

var railCollisions = {
  straight: [
    [-1,  0, ["close",  2]],
    [ 0,  0, ["middle", 0]],
    [ 1,  0, ["close",  0]]
  ],

  diagonal: [
    [-1,  1, ["close",  2]],
    [ 0,  0, ["middle", 0]],
    [ 1, -1, ["close",  0]]
  ],

  curved: [
    [-1,  1, ["close",     2]],
    [ 0,  0, ["arcMiddle", 2]],
    [ 0,  1, ["arc",       0]],
    [ 1, -1, ["close",     3]],
    [ 1,  0, ["arcR",      1]],
    [ 1,  1, ["arcMiddle", 0]]
  ]
};


var origin = [0, 0];
var aroundCells = [[1, 0], [0, 1], [-1, 0], [0, -1]];

var railEnds = ["close", "open"];
var arcs = ["arc", "arcR"];
var joints = ["connection", "corner"];
var straights = ["middle", "connection"];

var modes = ["touch", "straight", "diagonal", "curved", "eraser"];

function drawGrid() {
  for (var x = 0; x < canvasSize; x += cellSize) {
    for (var y = 0; y < canvasSize; y += cellSize) {
      gridCtx.strokeRect(x, y, cellSize, cellSize);
    }
  }
}

drawGrid();

function clearCanvas(context) {
  context.clearRect(0, 0, canvasSize, canvasSize);
}

function getPositions(cell, center) {
  var positions = [
    (cell[0] + center[0]) * cellSize, (cell[1] + center[1]) * cellSize
  ];

  return positions;
}

function drawSelects(cells, center) {
  cells.forEach(cell => {
    var [xPos, yPos] = getPositions(cell, center);

    selectCtx.fillRect(xPos, yPos, cellSize, cellSize);
  });
}

function clearSelects(cells, center) {
  cells.forEach(cell => {
    var [xPos, yPos] = getPositions(cell, center);

    selectCtx.clearRect(xPos, yPos, cellSize, cellSize);
  });
}

function getCellIndexes(event) {
  var rect = grid.getBoundingClientRect();
  var xCoor = event.clientX - rect.left;
  var yCoor = event.clientY - rect.top;

  var x = Math.floor(xCoor / cellSize);
  var y = Math.floor(yCoor / cellSize);

  return [x, y];
}

function resetCells(properties) {
  for (var key in properties) {
    var value = properties[key];

    cells.forEach(row => {
      row.forEach(cell => {
        cell[key] = value;
      });
    });
  }
}

function isRailIndex(index) {
  if (1 <= index && index <= 3) return true;
  return false;
}

var buttonModes = Array.from(document.querySelectorAll(".buttonMode"));

var modeIndex = 0;
var mode = modes[modeIndex];

var modeImage = new Image();
modeImage.src = `./images/modes/${mode}.png`;
modeImage.className = "modeImage";

function changeMode(button) {
  buttonModes[modeIndex].style.backgroundColor = "";

  modeIndex = buttonModes.findIndex(element => {
    return element == button;
  });

  mode = modes[modeIndex];
  modeImage.src = `./images/modes/${mode}.png`;

  button.style.backgroundColor = selectedButtonModeColor;

  modeDir = 0;
  modeImage.style.transform = "rotate(0)";

  if (isMouseOver) {
    createModeImage();
    followModeImage({clientX: lastClientX, clientY: lastClientY});
  }
}

document.addEventListener("keydown", event => {
  if (isClicking) return;

  var key = event.key;
  if (key == modeIndex + 1) return;

  if (1 <= key && key <= buttonModes.length) {
    buttonModes[key - 1].click();
  }
});

document.addEventListener("keydown", event => {
  if (isClicking) return;
  if (event.ctrlKey && event.key == "z") {
    restoreData(true);
  };
});

buttonModes[0].click();

function getCellObject(cell, center) {
  var [x, y] = center ? [cell[0] + center[0], cell[1] + center[1]] : cell;

  if (x >= gridNum || y >= gridNum) return false;
  return railCells[y][x];
}

function getSin(direction) {
  return [0, 1, 0, -1][direction];
}

function getCos(direction) {
  return [1, 0, -1, 0][direction];
}

var isClicking = false;

listener.addEventListener("mousedown", event => {
  isClicking = true;

  var isRail = isRailIndex(modeIndex);
  var center = getCellIndexes(event);

  if (isRail) {
    var collision = railCollisions[mode];

    var destinations = [];
    for (var i = 0; i < collision.length; i ++) {
      destinations.push(
        {type: "", joining: "", reverse: false, connections: []}
      );
    }

    var [sin, cos] = [getSin(modeDir), getCos(modeDir)];

    var rotateds = [];
    collision.forEach(cell => {
      var [x, y, data] = [cell[0], cell[1], cell[2]];

      rotateds.push([
        x * cos + y * -sin,
        x * sin + y * cos,
        [data[0], (data[1] + modeDir) % 4]
      ]);
    });

    for (var i = 0; i < rotateds.length; i ++) {
      var set = rotateds[i];
      var data = set[2];
      var after = data[0];
      var dir = data[1];

      var obj = getCellObject(set, center);
      if (!obj) {
        isClicking = false;
        return;
      }

      var before = obj.part;

      if (before != "") {
        if (railEnds.includes(before) && after == "close") {
          var type0 = mode.toUpperCase()[0] == "D" ? "D" : "S";
          var type1 = obj.type;
          var [dir0, dir1] = [dir, obj.dir];

          destinations[i].connections = (type0 == "S") ? [dir0, dir1] : [dir1, dir0];

          if (dir0 == 0 && dir1 == 3) dir0 = 4;
          else if (dir0 == 3 && dir1 == 0) dir1 = 4;
          var deltaDir = dir0 - dir1;


          if (type0 == type1) {
            destinations[i].type = type0;

            if (deltaDir % 2 == 0) {
              rotateds[i][2][0] = "connection";

            } else {
              rotateds[i][2][0] = "corner";

              if (deltaDir > 0) rotateds[i][2][1] += 3;
            }

          } else {
            rotateds[i][2][0] = "corner";
            destinations[i].type = type1;

            var dirs = [dir0, dir1];
            var s = type0 == "S" ? 0 : 1;

            var acute = [-1, 1][s];
            var isAcute = [0, acute].includes(deltaDir);
            destinations[i].joining = isAcute ? "a" : "o";

            rotateds[i][2][1] = dirs[s] % 4;
            if (Math.abs(deltaDir) % 2 == !isAcute) destinations[i].reverse = true;
          }

        } else {
          isClicking = false;
          return;
        }
      }

      if (mode == "diagonal" && after == "middle") {
        var around = [];
        aroundCells.forEach(cell => {
          around.push(getCellObject(cell, center));
        });

        for (var cell of around) {
          if (cell.type == "D" && cell.part == "middle" && (cell.dir % 2) != (dir % 2)) {
            isClicking = false;
            return;
          }
        }
      }
    }

    drawSelects(rotateds, center);

  } else {
    drawSelects([origin], center);
  }

  document.addEventListener("mouseup", () => {
    isClicking = false;

    var offset = cellSize / 2;

    if (isRail) {
      clearSelects(rotateds, center);
      saveData();

      var type = "";

      if (mode != "curved") {
        type = (mode == "straight") ? "S" : "D";
      }

      rotateds.forEach((set, i) => {
        var cell = [set[0], set[1]];
        var [xPos, yPos] = getPositions(cell, center);
        var [part, dir] = set[2];
        var isReverse = false;

        var obj = getCellObject(cell, center);

        obj.part = part;
        obj.dir = dir % 4;

        if (mode == "curved") {
          type = [...arcs, "arcMiddle"].includes(part) ? "" : "S";
        }

        if (part == "arcR") [isReverse, part] = [true, "arc"];

        var des = destinations[i];
        var current = type;

        obj.connections = des.connections;

        if (part == "corner" && des.reverse) isReverse = true;
        if (`${type}${des.type}` == "DS") {
          current = "S"
          des.type = "D";
        }

        obj.type = `${current}${des.type}` || "C";

        var image = new Image();
        image.src = `./images/parts/${part}${current}${des.type}${des.joining}.png`;

        if (joints.includes(part)) {
          railsCtx.clearRect(xPos, yPos, cellSize, cellSize);
        }

        drawPart(image, xPos, yPos, offset, dir, isReverse);
      });

    } else {
      clearSelects([origin], center);

      var obj = getCellObject(origin, center);

      if (modeIndex == 0) {
        var before = obj.part;
        if (!railEnds.includes(before)) return;

        saveData();

        var after = before == "close" ? "open" : "close";
        var [dir, type] = [obj.dir, obj.type];

        obj.part = after;

        var [xPos, yPos] = getPositions(origin, center);
        railsCtx.clearRect(xPos, yPos, cellSize, cellSize);

        var image = new Image();
        image.src = `./images/parts/${after}${type}.png`;

        drawPart(image, xPos, yPos, offset, dir);

      } else {
        var part = obj.part;
        if ([...joints, ""].includes(part)) return;

        saveData();

        var [type, dir] = [obj.type, obj.dir];
        var [rail, railDir] = [];

        if (type == "S") {
          if (part == "middle") {
            rail = "straight";

          } else {
            var des = getCellObject(aroundCells[(dir + 2) % 4], center);
            rail = des.type == "S" ? "straight" : "curved";
          }

        } else {
          rail = type == "D" ? "diagonal" : "curved";
        }

        if (rail == "curved") {
          var arc;
          if (arcs.includes(part)) {
            arc = obj;

          } else {
            var facing = (part == "arcMiddle") ? 3 : 2;
            arc = getCellObject(aroundCells[(dir + facing) % 4], center);
          }

          railDir = arc.dir + (arc.part == "arc" ? 0 : 3);

        } else {
          railDir = dir % 2;
        }

        var collision = railCollisions[rail];
        railDir %= 4;

        var [sin, cos] = [getSin(railDir), getCos(railDir)];

        var rotated = collision.map(cell => {
          var [x, y, data] = [cell[0], cell[1], cell[2]];

          return [
            x * cos + y * -sin,
            x * sin + y * cos,
            [data[0], (data[1] + railDir) % 4]
          ];
        });

        var clickedIndex = rotated.findIndex(cell => {
          var data = cell[2];

          if (part == "open") part = "close";
          var isSamePart = data[0] == part;
          var isSameDir = (part == "middle") ? (data[1] % 2 == dir % 2) : (data[1] == dir % 4);

          return isSamePart && isSameDir;
        });

        var clickedCell = rotated[clickedIndex];
        var railCenter = [
          center[0] - clickedCell[0], center[1] - clickedCell[1]
        ];

        rotated.forEach(cell => {
          var newObj = ["", "", ""];
          var cellObj = getCellObject(cell, railCenter);
          var [xPos, yPos] = getPositions(cell, railCenter);

          railsCtx.clearRect(xPos, yPos, cellSize, cellSize);

          var jointPart = cellObj.part;

          if (joints.includes(jointPart)) {
            var jointType = cellObj.type.slice(-2);
            var removeType = (type == "D") ? "D" : "S";
            var restType = jointType.replace(removeType, "");

            var connections = cellObj.connections;
            var restDir = connections[(cell[2][1] == connections[0]) ? 1 : 0];

            var image = new Image();
            image.src = `./images/parts/close${restType}.png`;
            drawPart(image, xPos, yPos, offset, restDir);

            newObj = ["close", restDir, restType];
          }

          [cellObj.part, cellObj.dir, cellObj.type] = [...newObj];
        });

        drawSelects(rotated, railCenter);
        setInterval(() => clearSelects(rotated, railCenter), 50);
      }
    }
  }, {once: true});
});

function drawPart(image, xPos, yPos, offset, dir, isReverse) {
  image.onload = () => {
    railsCtx.save();

    railsCtx.translate(xPos + offset , yPos + offset);
    railsCtx.rotate(dir * 0.5 * Math.PI);
    if (isReverse) railsCtx.scale(1, -1);

    railsCtx.drawImage(image, -offset, -offset, cellSize, cellSize);
    railsCtx.restore();
  }
}

var imageRadius;

function createModeImage() {
  var imageSize = isRailIndex(modeIndex) ? cellSize * 3 : cellSize;
  imageRadius = imageSize / 2;

  modeImage.style.width = `${imageSize}px`;

  document.body.appendChild(modeImage);
  listener.addEventListener("mousemove", followModeImage);
}

var lastClientX, lastClientY;

function followModeImage(event) {
  [lastClientX, lastClientY] = [event.clientX, event.clientY];

  modeImage.style.left = `${lastClientX - imageRadius}px`;
  modeImage.style.top  = `${lastClientY - imageRadius}px`;
}

function removeModeImage() {
  listener.removeEventListener("mousemove", followModeImage);
  modeImage.remove();
}

var isMouseOver = false;

listener.addEventListener("mouseenter", () => {
  isMouseOver = true;
  createModeImage();

  body.style.overflowY = "hidden";
});

listener.addEventListener("mouseleave", () => {
  isMouseOver = false;
  removeModeImage();

  body.style.overflowY = "scroll";
});

var modeDir = 0;

document.addEventListener("wheel", event => {
  if (isMouseOver) rotateRailImage(event, true);
});

function rotateRailImage(event, isWheel) {
  var deltaY = event.deltaY;

  if (deltaY == 0) return;
  if (!isRailIndex(modeIndex)) return;
  if (isClicking) return;

  var rotation = deltaY > 0 ? 1 : 3;
  modeDir = (modeDir + rotation) % 4;

  modeImage.style.transform = `rotate(${modeDir / 4}turn)`;

  if (isWheel) markButtonFeature(rotation == 1 ? "Right" : "Left");
}

function markButtonFeature(name) {
  var button = document.getElementById(`button${name}`);
  var style = button.style;

  style.backgroundColor = markButtonFeatureColor;

  setTimeout(() => {
    style.backgroundColor = "";
  }, 100);
}

function copyArray(array) {
  return JSON.parse(JSON.stringify(array));
}

function saveData() {
  lastRails = rails.toDataURL();
  lastRailCells = copyArray(railCells);

  buttonUndo.disabled = false;
}

function restoreData(isSortcut) {
  if (buttonUndo.disabled) return;
  if (isSortcut) markButtonFeature("Undo");

  var image = new Image();
  image.src = lastRails;

  image.onload = () => {
    clearCanvas(railsCtx);
    railsCtx.drawImage(image, 0, 0);
  }

  railCells = copyArray(lastRailCells);

  buttonUndo.disabled = true;
}

document.querySelectorAll(".buttonMode").forEach(button =>{
  button.title = button.children[0].alt;
});

document.querySelectorAll(".buttonFeature").forEach(button => {
  button.title = button.children[0].alt;

  button.addEventListener("mousedown", () => {
    var style = button.style;
    style.backgroundColor = markButtonFeatureColor;

    document.addEventListener("mouseup", () => {
      style.backgroundColor = "";
    });
  });
});

resetRailCells();

function resetData() {
  saveData();

  clearCanvas(railsCtx);
  resetRailCells();

  resultPeriod.textContent = "";
}

function getNextObject(obj, center, lastType, lastDir) {
  var [part, type, dir, connections] = [obj.part, obj.type, obj.dir, obj.connections];

  if (lastType == "C") lastType = "S";

  if (railEnds.includes(part)) {
    var currentDir = (dir + 2) % 4;

    var nextCells = (type == "S") ? aroundCells : [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    var nextCell = nextCells[currentDir];

  } else if (straights.includes(part)) {
    var currentDir = lastDir;

    var nextCells = (type[0] == "S") ? aroundCells : [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    var nextCell = nextCells[currentDir];

  } else if (part == "corner") {
    var currentDir = (connections[(lastDir == connections[0]) ? 1 : 0] + 2) % 4;
    var nextType = type.replace(lastType, "");

    var nextCells = (nextType == "S") ? aroundCells : [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    var nextCell = nextCells[currentDir];

  } else {
    var isReverse = part == "arcR";
    var currentDir = dir;

    var nextCells = [
      [[1, -2], [2, 1], [-1, 2], [-2, -1]], [[1, 2], [-2, 1], [-1, -2], [2, -1]]
    ][isReverse ? 1 : 0];

    var nextCell = nextCells[currentDir];
    currentDir = (currentDir + (isReverse ? 1 : 3)) % 4;
  }

  var nextIndexes = [nextCell[0] + center[0], nextCell[1] + center[1]];
  var nextObj = getCellObject(nextIndexes);

  return [nextObj, nextIndexes, currentDir];
}

var slowness = 32 / 3;

function calcPeriod() {
  var startObj;
  var startIndexes = [];
  var [preDir, preType] = ["", ""];
  var isError = true;

  findEdge: for (var y = 0; y < gridNum; y ++) {
    var row = railCells[y];

    for (var x = 0; x < gridNum; x ++) {
      startObj = row[x];

      if (["close", "corner", "arc"].includes(startObj.part)) {
        startIndexes = [x, y];
        break findEdge;
      }
    }
  }

  if (!startIndexes.length) {
    resultPeriod.textContent = "";
    return;
  }

  var period = 0;

  var obj = startObj;
  var indexes = startIndexes;

  var lastType, lastDir;

  switch (obj.part) {
    case "close":
      lastType = obj.type;
      lastDir = obj.dir;
      break;

    case "corner":
      lastType = obj.type[0];
      lastDir = obj.connections[0];
      break;

    default:
      lastType = "S";
      lastDir = obj.dir;
  }

  preType = lastType;
  preDir = lastDir;

  var straightLength = 0;
  var count = 0;

  console.log(startIndexes);
  console.log(startObj);
  console.log(preType);
  console.log(preDir);

  calc: {
    while (true) {
      var [nextObj, nextIndexes, dir] = getNextObject(
        obj, indexes, lastType, lastDir
      );

      var nextPart = nextObj.part;

      if (straights.includes(nextPart)) {
        straightLength += arcs.includes(obj.part) ? 0.5 : 1;
      }

      if ([...railEnds, "corner", ...arcs].includes(nextPart)) {
        var isArc = arcs.includes(nextPart);
        straightLength += (isArc || arcs.includes(obj.part)) ? 0.5 : 1;

        period += Math.floor(straightLength * slowness *
          (obj.type == "D" ? Math.SQRT2 : 1)
        );

        straightLength = 0;

        if (nextPart == "open") {
          break calc;

        } else if (isArc) {
          period += 26;
        }
      }

      indexes = nextIndexes;
      lastType = (obj.type == "C") ? "S" : obj.type;
      lastDir = dir;
      obj = nextObj;

      if (
        startIndexes[0] == indexes[0] && startIndexes[1] == indexes[1]
        && preDir == lastDir && preType == lastType[0]
      ) break;

      count ++;
      if (count >= 500) break calc;
    }

    isError = false;
    resultPeriod.textContent = period;
  }

  if (isError) {
    resultPeriod.textContent = "";

    alert("軌道が無効か大きすぎます。");
  }
}
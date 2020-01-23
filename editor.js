import './codemirror.js'
import './codemirror/mode/javascript/javascript.js'
import './codemirror/addon/display/fullscreen.js'
import './codemirror/addon/scroll/simplescrollbars.js'
import './codemirror/addon/comment/comment.js'
import './codemirror/addon/lint/lint.js'
import './codemirror/addon/lint/javascript-lint.js'
import './codemirror/keymap/sublime.js'
import './typewriter.js'
// import './blast.js'

export const editor = CodeMirror.fromTextArea(window.editor, {
  lineNumbers: true,
  theme: 'night',
  fullScreen: true,
  keyMap: 'sublime',
  scrollbarStyle: 'overlay',
  lint: { esversion: 10 },
  lineWrapping: true,
  typewriterScrolling: true,
  indentWithTabs: false,
  smartIndent: true,
  extraKeys: {
    Tab: (cm) => {
      if (cm.getMode().name === 'null') {
        cm.execCommand('insertTab');
      } else {
        if (cm.somethingSelected()) {
          cm.execCommand('indentMore');
        } else {
          cm.execCommand('insertSoftTab');
        }
      }
    },
    Backspace: (cm) => {
      if (!cm.somethingSelected()) {
        let cursorsPos = cm.listSelections().map((selection) => selection.anchor);
        let indentUnit = cm.options.indentUnit;
        let shouldDelChar = false;
        for (let cursorIndex in cursorsPos) {
          let cursorPos = cursorsPos[cursorIndex];
          let indentation = cm.getStateAfter(cursorPos.line).indented;
          if (!(indentation !== 0 &&
             cursorPos.ch <= indentation &&
             cursorPos.ch % indentUnit === 0)) {
            shouldDelChar = true;
          }
        }
        if (!shouldDelChar) {
          cm.execCommand('indentLess');
        } else {
          cm.execCommand('delCharBefore');
        }
      } else {
        cm.execCommand('delCharBefore');
      }
    },
    'Shift-Tab': (cm) => cm.execCommand('indentLess')
  }
  // blastCode: { effect: 2 },
})

// editor.setOption("extraKeys", {
//   Tab: function(cm) {
//     var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
//     cm.replaceSelection(spaces);
//   }
// })

// align wrap indent to previous line's
var charWidth = editor.defaultCharWidth(), basePadding = 4;
editor.on("renderLine", function(cm, line, elt) {
  var off = (CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) + 2) * charWidth;
  elt.style.textIndent = "-" + off + "px";
  elt.style.paddingLeft = (basePadding + off) + "px";
});
editor.refresh();

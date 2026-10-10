import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';

function decorate(doc: Node) {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const m of node.text.matchAll(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g)) {
      decos.push(Decoration.inline(pos + m.index!, pos + m.index! + m[0].length, { class: 'var-chip' }));
    }
  });
  return DecorationSet.create(doc, decos);
}

/** Evidenzia le variabili {{...}} mentre si scrive. */
export const VariableHighlight = Extension.create({
  name: 'variableHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableHighlight'),
        state: { init: (_, { doc }) => decorate(doc), apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old) },
        props: { decorations(state) { return this.getState(state); } },
      }),
    ];
  },
});

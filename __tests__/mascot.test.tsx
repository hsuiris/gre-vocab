import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Mascot } from '../src/components/Mascot';

function readable(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((node) => (typeof node.props.children === 'string' ? node.props.children : ''))
    .join(' ');
}

async function mount(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(element);
  });
  return tree;
}

async function unmount(tree: renderer.ReactTestRenderer) {
  await act(async () => tree.unmount());
}

it('shows its speech bubble only when given a line', async () => {
  const withLine = await mount(<Mascot message="慢慢來，我陪你" />);
  expect(readable(withLine)).toContain('慢慢來，我陪你');
  await unmount(withLine);

  const silent = await mount(<Mascot />);
  expect(readable(silent)).toBe('');
  await unmount(silent);
});

it('survives every mood change without remounting', async () => {
  const tree = await mount(<Mascot mood="idle" message="嗨" />);
  for (const mood of ['happy', 'sad', 'idle'] as const) {
    await act(async () => tree.update(<Mascot mood={mood} message="嗨" />));
  }
  expect(readable(tree)).toContain('嗨');
  await unmount(tree);
});

// The breathing loop runs forever by design. If unmount did not stop it, this
// suite would keep firing timers after Jest tears the environment down — which
// is exactly the hang this test exists to catch.
it('stops its idle animation when unmounted', async () => {
  const tree = await mount(<Mascot />);
  await unmount(tree);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  expect(tree.toJSON()).toBeNull();
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { SinglyLinkedList, Stack, CircularQueue, BinarySearchTree, HashTable, mergeSort, binarySearch } = require('./data-structures');

test('singly linked list prepends newest telemetry history', () => {
  const list = new SinglyLinkedList();
  list.prepend({ id: 1 }); list.prepend({ id: 2 });
  assert.deepEqual(list.toArray().map(x => x.id), [2, 1]);
  assert.equal(list.length, 2);
});

test('stack follows LIFO and respects its configured history limit', () => {
  const stack = new Stack(2);
  stack.push('register'); stack.push('queue'); stack.push('transmit');
  assert.equal(stack.pop(), 'transmit');
  assert.equal(stack.peek(), 'queue');
  assert.deepEqual(stack.toArrayNewestFirst(), ['queue']);
});

test('circular queue preserves FIFO and reuses wrapped slots', () => {
  const queue = new CircularQueue(3);
  assert.equal(queue.enqueue(101), true);
  assert.equal(queue.enqueue(102), true);
  assert.equal(queue.enqueue(103), true);
  assert.equal(queue.enqueue(104), false);
  assert.equal(queue.dequeue(), 101);
  assert.equal(queue.enqueue(104), true);
  assert.deepEqual(queue.toArray(), [102, 103, 104]);
  assert.equal(queue.dequeue(), 102);
});

test('binary search tree returns event IDs in order and searches IDs', () => {
  const tree = new BinarySearchTree();
  [205, 102, 180, 180].forEach(x => tree.insert(x));
  assert.deepEqual(tree.inorder(), [102, 180, 205]);
  assert.equal(tree.search(180), true);
  assert.equal(tree.search(999), false);
});

test('hash table handles collisions with separate chaining', () => {
  const table = new HashTable(11);
  table.set(101, 'TT&C'); table.set(112, 'SSTV');
  assert.equal(table.bucketFor(101), table.bucketFor(112));
  assert.equal(table.get(101), 'TT&C');
  assert.equal(table.get(112), 'SSTV');
  assert.equal(table.get(999), null);
});

test('merge sort and binary search work on telemetry timestamps', () => {
  const packets = [{ timestamp: 30 }, { timestamp: 10 }, { timestamp: 20 }];
  const sorted = mergeSort(packets, (a, b) => a.timestamp - b.timestamp);
  assert.deepEqual(sorted.map(p => p.timestamp), [10, 20, 30]);
  assert.equal(binarySearch(sorted, 20, p => p.timestamp).timestamp, 20);
  assert.equal(binarySearch(sorted, 99, p => p.timestamp), null);
});

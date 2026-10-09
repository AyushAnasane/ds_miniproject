/* Educational data structures used by the SomaiyaSat mission simulation. */
class ListNode { constructor(value) { this.value = value; this.next = null; } }
class SinglyLinkedList {
  constructor() { this.head = null; this.length = 0; }
  prepend(value) { const n = new ListNode(value); n.next = this.head; this.head = n; this.length++; }
  toArray(limit = Infinity) { const out = []; let n = this.head; while (n && out.length < limit) { out.push(n.value); n = n.next; } return out; }
}
class Stack {
  constructor(limit = 10) { this.items = []; this.limit = limit; }
  push(value) { this.items.push(value); if (this.items.length > this.limit) this.items.shift(); }
  pop() { return this.items.pop(); }
  peek() { return this.items[this.items.length - 1] ?? null; }
  toArrayNewestFirst() { return [...this.items].reverse(); }
}
class CircularQueue {
  constructor(capacity) { this.capacity = capacity; this.items = Array(capacity); this.front = 0; this.size = 0; }
  enqueue(value) { if (this.size === this.capacity) return false; const rear = (this.front + this.size) % this.capacity; this.items[rear] = value; this.size++; return true; }
  dequeue() { if (!this.size) return null; const value = this.items[this.front]; this.items[this.front] = undefined; this.front = (this.front + 1) % this.capacity; this.size--; return value; }
  toArray() { return Array.from({ length: this.size }, (_, i) => this.items[(this.front + i) % this.capacity]); }
}
class BSTNode { constructor(value) { this.value = value; this.left = null; this.right = null; } }
class BinarySearchTree {
  constructor() { this.root = null; }
  insert(value) { const add = (node) => { if (!node) return new BSTNode(value); if (value < node.value) node.left = add(node.left); else if (value > node.value) node.right = add(node.right); return node; }; this.root = add(this.root); }
  inorder() { const out = []; const walk = n => { if (!n) return; walk(n.left); out.push(n.value); walk(n.right); }; walk(this.root); return out; }
  search(value) { let n = this.root; while (n) { if (n.value === value) return true; n = value < n.value ? n.left : n.right; } return false; }
}
class HashTable {
  constructor(size = 11) { this.size = size; this.buckets = Array.from({ length: size }, () => []); }
  hash(key) { return ((Number(key) % this.size) + this.size) % this.size; }
  set(key, value) { const bucket = this.buckets[this.hash(key)]; const pair = bucket.find(p => p.key === Number(key)); if (pair) pair.value = value; else bucket.push({ key: Number(key), value }); }
  get(key) { return this.buckets[this.hash(key)].find(p => p.key === Number(key))?.value ?? null; }
  bucketFor(key) { return this.hash(key); }
}
function mergeSort(items, compare) {
  if (items.length <= 1) return [...items];
  const mid = Math.floor(items.length / 2), left = mergeSort(items.slice(0, mid), compare), right = mergeSort(items.slice(mid), compare), out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) out.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++]);
  return out.concat(left.slice(i), right.slice(j));
}
function binarySearch(items, target, getKey) {
  let low = 0, high = items.length - 1;
  while (low <= high) { const mid = Math.floor((low + high) / 2), key = getKey(items[mid]); if (key === target) return items[mid]; if (key < target) low = mid + 1; else high = mid - 1; }
  return null;
}
module.exports = { SinglyLinkedList, Stack, CircularQueue, BinarySearchTree, HashTable, mergeSort, binarySearch };

<script>
  import { onMount, onDestroy } from "svelte";
  import Keypad from "./Keypad.svelte";
  import biblia from "./roh.json";

  let shown = false;
  let line1 = '';
  let line2 = '';
  let lastAddresses = [
    {book: "gn", chapter: 1, verse: 1, verseto: 1},
    {book: "z", chapter: 150, verse: 1, verseto: 1},
    {book: "jn", chapter: 3, verse: 16, verseto: 16},
  ];

  let books = biblia.books;
  let booksByAbbr = new Map();
  books.forEach(book => {booksByAbbr[book.abbreviation] = book});

  let bookFilter = "";
  let aBook;

  let selected = {
    book: "gn",
    chapter: 1,
    verse: 1,
    verseto: 1
  }
  let shownAddress = selected;

  let gun = Gun('http://gun-overlays.herokuapp.com/gun');
  let overlay = gun.get('bible-overlay');
  overlay.map().on(function(data, key){
    console.log('Received', key, data);
  });
  overlay.get('show').on(function(data, key){shown = data});
  let overlayAddress = overlay.get('address');
  overlayAddress.map().on(function(data, key){shownAddress[key] = data});
  overlay.get('line1').on(function(data){line1 = data});
  overlay.get('line2').on(function(data){line2 = data});

  $: filteredBooks = bookFilter
    ? books.filter(matchesBook)
    : books;
  // $: filteredLastAddresses = bookFilter
  //   ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
  //   : lastAddresses;

  function matchesBook(book) {
    const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      bookLower.startsWith(prefix) ||
      book.abbreviation.startsWith(prefix) ||
      (book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix))) ||
      (prefix.length >= 2 && bookLower.includes(' '+prefix))
    );
  }

  $: aBook = booksByAbbr[shownAddress.book];
  $: selected.verseto = selected.verse;
  $: overlayAddress.put(selected);
  $: overlay.get('line1').put(addressAsString(selected));
  $: overlay.get('line2').put(addressContent(selected));

  function addToLastAddresses(address) {
    lastAddresses.unshift({
      book: address.book,
      chapter: address.chapter,
      verse: address.verse,
      verseto: address.verseto
    });
    lastAddresses = lastAddresses.filter((h,i) => i === 0 || !equalAddresses(h, address));
  }

  function addressAsString(address){
    return booksByAbbr[address.book].name + ' ' +
           address.chapter +
           (address.verse ? ','+address.verse : '') +
           (address.verseto != address.verse && address.verseto ? '-'+address.verseto : '');
  }

  function addressContent(address){
    var book = booksByAbbr[shownAddress.book];
    var content = '';
    if (book.chapters[selected.chapter]) {
      for (var i=selected.verse; i <= selected.verseto; i++) {
        content += book.chapters[selected.chapter][i-1] || '';
      }
    }
    return content;
  };

  function equalAddresses(a, b) {
    return  a.book == b.book &&
            a.chapter == b.chapter &&
            a.verse == b.verse &&
            a.verseto == b.verseto;
  }

  function addressSelector(address) {
    address.chapter = address.chapter || '';
    address.verse = address.verse || '';
    address.verseto = address.verseto || '';
    return function() {selected = address};
  }

  function removeLastAddress(j) {
    return function() {
      lastAddresses = lastAddresses.filter((h, i) => (i !== j));
    }
  }

  function toggleLine() {
    shown = !shown;
    overlay.get('show').put(shown);
    if (shown) {
      addToLastAddresses(selected);
    }
  }
</script>

<style>
  .control-button {
    width: 6rem;
    /* float: right; */
  }
  .books-filter,
  .address-filter {
    display: block;
    width: 49%;
    margin: 0 1% 0 0;
    padding: 0;
    height: 10rem;
    overflow: scroll;
    float: left;
  }
  .book-item {
    width: 100%;
    margin: 0 0 .25rem 0;
    padding: .25rem .5rem;
    text-align: left;
  }
  .address-item {
    width: 100%;
    margin: 0 0 .25rem 0;
  }
  .address-set {
    width: auto;
    padding: .25rem .5rem;
    margin: 0;
    text-align: left;
  }
  .address-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
  }
  .vers,
  .address {
    color: white;
  }
  :global(body) {
    color: white;
  }
</style>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} />
  <button type="button" class="form-control btn btn-secondary" on:click={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as book}
  <button class="book-item btn" class:btn-primary={book.abbreviation==shownAddress.book} on:click={addressSelector({book: book.abbreviation})}>{book.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each lastAddresses as address, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(address, shownAddress)} on:click={addressSelector(address)}>{addressAsString(address)}</button>
    <button class="btn address-remove" on:click={removeLastAddress(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: 0 .5rem 0 0;">
  Kapitola: {selected.chapter}
  <Keypad bind:value={selected.chapter} max={Object.keys(aBook.chapters).length} />
</div>
<div style="display: inline-block;">
  Verš: {selected.verse}
  <Keypad bind:value={selected.verse} max={(aBook.chapters[selected.chapter]||[]).length} />
</div>

<button class="control-button btn" on:click={toggleLine} class:btn-danger={shown} class:btn-success={!shown}>
  {#if shown}Skryť{:else}Zobraziť{/if}
</button>
<div class="address">{line1}</div>
<span class="vers">{@html line2}</span>


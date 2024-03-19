<script type="javascript">
  import { onMount } from "svelte";
  import NumberPad from "$lib/NumberPad.svelte";
  import { Gun, wrapStore } from '$lib/gun.js';
  import { page } from "$app/stores";
	import { writable } from 'svelte/store';
  import {index as roh} from "./roh.json.js"
  import {index as seb} from "./seb.json.js"
  import {index as sep} from "./sep.json.js"
  import {index as ssv} from "./ssv.json.js"
  import {index as bot} from "./bot.json.js"
  import {index as kjv} from "./kjv.json.js"

  let bibles = {roh, seb, sep, ssv, bot, kjv};
  let loadingBible = false;
  let loadingBook = false;

  let defaultAddress = { bible: "roh", book: "gn", chapter: 1, verse: 1, verseCount: 1 };
  let bookList = [];
  let books1 = new Map();
  let books2 = new Map();

  let bookFilter = "";
  let shownBook;
  let lastAddresses = [defaultAddress,];
  let address = {...defaultAddress};
  let address2 = {...defaultAddress};

  let overlay;

  /* Synced variables */
  let shown   = writable(false);
  let line1   = writable('line1');
  let line2   = writable('line2');
  let line3   = writable('line3');
  let line4   = writable('line4');
  let book    = writable(defaultAddress.book);
  let chapter = writable(defaultAddress.chapter);
  let verse   = writable(defaultAddress.verse);
  let verseCount = writable(defaultAddress.verseCount);
  let theme   = writable('');
  let bibleid = writable('roh');
  let bibleid2 = writable('');
  let allinone = writable('{}');

	onMount(() => {
    const gun = Gun([
        'https://gun.filiphanes.sk/gun',
    ])

    overlay = gun.get('bible').get($page.url.hash.slice(1) || 'demo');
    /* Synced variables */
    shown   = wrapStore(overlay.get('show'), shown);
    line1   = wrapStore(overlay.get('line1'), line1);
    line2   = wrapStore(overlay.get('line2'), line2);
    line3   = wrapStore(overlay.get('line3'), line3);
    line4   = wrapStore(overlay.get('line4'), line4);
    book    = wrapStore(overlay.get('book'), book);
    chapter = wrapStore(overlay.get('chapter'), chapter);
    verse   = wrapStore(overlay.get('verse'), verse);
    verseCount = wrapStore(overlay.get('verseCount'), verseCount);
    theme   = wrapStore(overlay.get('theme'), theme);
    bibleid = wrapStore(overlay.get('bibleid'), bibleid);
    bibleid2 = wrapStore(overlay.get('bibleid2'), bibleid2);
    allinone = wrapStore(overlay.get('allinone'), allinone);

    return () => {};
  })

  $: address = {bible: $bibleid, book: $book, chapter: $chapter, verse: $verse, verseCount: $verseCount};
  $: address2 = {bible: $bibleid2, book: $book, chapter: $chapter, verse: $verse, verseCount: $verseCount};
  $: $line1 = addressAsString(address, books1);
  $: $line2 = addressContent(address, books1);
  $: $line3 = addressAsString(address2, books2);
  $: $line4 = addressContent(address2, books2);
  $: $allinone = JSON.stringify({shown:$shown, line1:$line1, line2:$line2, line3:$line3, line4:$line4})
  $: loadBible($bibleid || 'roh', books1, true);
  $: loadBible($bibleid2, books2, false);
  $: shownBook = books1[$book] || {chapters: {}};
  $: filteredBooks = bookFilter ? bookList.filter(matchesBook) : bookList;
  $: chapterLength = ((shownBook.chapters||{})[$chapter]||[]).length;
  $: bookLength = Object.keys(shownBook.chapters||{}).length;

  /* Disabled last address filtering
  $: filteredLastAddresses = bookFilter
    ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
    : lastAddresses;
  */

  function loadBible(bibleid, books, updateBookList) {
    if (!bibleid) {
      books.clear();
      return;
    }
    bibles[bibleid].books.forEach(function(book) {
      books[book.abbreviation] = book;
    })
    if (updateBookList) {
      bookList = bibles[bibleid].books;
      for (let i=0; i<bookList.length; i++) {
        bookList[i].index = i;
      }
      /* Redraw */
      bookList = bookList;
    }
  }

  function loadBook(bibleid, abbreviation, books) {
    if (!bibleid) return;
    loadingBook = true;
    // console.log('Loading book', bibleid, abbreviation)
    fetch('/bible/' + (bibleid || 'roh') + '/' + abbreviation + '.json')
    .then(response => response.json())
    .then(data => {
      books[abbreviation].chapters = data;
      /* Redraw */
      address = address;
      loadingBook = false;
      $book = $book;
      // console.log('loadedBook', bibleid, abbreviation);
    })
  }

  function matchesBook(book) {
    const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      bookLower.startsWith(prefix) ||
      book.abbreviation.startsWith(prefix) ||
      (book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix))) ||
      (prefix.length >= 2 && bookLower.includes(' ' + prefix))
    );
  }

  function addToLastAddresses(address) {
    lastAddresses.unshift({
      book: address.book,
      chapter: address.chapter,
      verse: address.verse,
      verseCount: address.verseCount
    });
    lastAddresses = lastAddresses.filter((h, i) => i === 0 || !equalAddresses(h, address));
  }

  function addressAsString(address, books) {
    if (address === undefined) return '';
    if (!books[address.book]) return '';
    var s = books[address.book].name + ' ' + address.chapter;
    if (address.verse) {
      s += ',' + address.verse;
      if (address.verseCount > 1) {
        s += '-' + (address.verse + address.verseCount - 1);
      }
    }
    return s;
  }

  function addressContent(address, books) {
    if (address === undefined) return '';
    var content = '';
    var book = books[address.book];
    // console.log('addressContent', bibleid, address, books);
    if (book) {
      if (!book.chapters) {
        loadBook(address.bible, address.book, books);
        return content;
      }
      if (address.verse && book.chapters[address.chapter]) {
        for (var i = address.verse; i < address.verse + address.verseCount; i++) {
          content += '\n' + (book.chapters[address.chapter][i - 1] || '');
        }
      }
    }
    return content;
  };

  function equalAddresses(a, b) {
    return b !== undefined &&
      a.book == b.book &&
      a.chapter == b.chapter &&
      a.verse == b.verse &&
      a.verseCount == b.verseCount;
  }

  function addressSelector(a) {
    a.chapter = a.chapter || '';
    a.verse = a.verse || '';
    a.verseCount = a.verseCount || 1;
    return function () {
      $book = a.book;
      $chapter = a.chapter;
      $verse = a.verse;
      $verseCount = a.verseCount;
    };
  }

  function removeLastAddress(j) {
    return function () {
      lastAddresses = lastAddresses.filter((h, i) => (i !== j));
    }
  }

  function toggleLine() {
    $shown = !$shown;
    if ($shown) {
      addToLastAddresses(address);
    }
  }

  function decrementVerse() {
    $verse = +$verse - 1;
    if ($verse <= 0) {
      decrementChapter();
      chapterLength = books1[$book].chapters[$chapter].length;
      $verse = chapterLength;
    }
  };

  function incrementVerse() {
    $verse = +$verse + 1;
    if ($verse > chapterLength) {
      incrementChapter();
      $verse = 1;
    }
  };

  function decrementChapter() {
    $chapter = +$chapter - 1;
    if ($chapter <= 0) {
      decrementBook();
      $chapter = Object.keys(books1[$book].chapters||{}).length;
    }
  };

  function incrementChapter() {
    $chapter = +$chapter + 1;
    if ($chapter > bookLength) {
      incrementBook();
      $chapter = 1;
      $verse = 1;
    }
  };

  function decrementBook() {
    const newIndex = books1[$book].index - 1 + bookList.length;
    $book = bookList[newIndex%bookList.length].abbreviation;
    console.log('newIndex', newIndex, $book);
  };

  function incrementBook() {
    const newIndex = books1[$book].index + 1;
    $book = bookList[newIndex%bookList.length].abbreviation;
  };
</script>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} style="flex-grow:1;" />
  <button type="button" class="form-control btn btn-secondary" on:click={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as b}
  <button class="book-item btn" class:btn-primary={b.abbreviation==$book} on:click={addressSelector({book: b.abbreviation})}>{b.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each lastAddresses as addr, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(addr, address)} on:click={addressSelector(addr)}>{addressAsString(addr, books1) || (addr.book+' '+addr.chapter+','+addr.verse)}</button>
    <button class="btn btn-secondary address-remove" on:click={removeLastAddress(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Kapitola: {$chapter} z {bookLength}
  <NumberPad bind:value={$chapter} max={bookLength} />
  <button class="btn btn-primary" on:click={decrementChapter} style="line-height: 2rem;"
  >-1</button><button class="btn btn-primary" on:click={incrementChapter} style="line-height: 2rem;"
  >+1</button><br/><button class="control-button btn" style="line-height: 2rem;" on:click={toggleLine} class:btn-danger={$shown} class:btn-success={!$shown}
  >{#if $shown}Skryť{:else}Zobraziť{/if}</button>
</div>
<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Verš: {$verse} {#if $verseCount>1} - {$verse + $verseCount - 1}{/if} z {chapterLength}
  <NumberPad bind:value={$verse} max={chapterLength} />
  <button class="btn btn-primary" on:click={decrementVerse} style="line-height: 2rem;"
  >-1</button><button class="btn btn-primary" on:click={incrementVerse} style="line-height: 2rem;"
  >+1</button><br/><button disabled style="background: transparent;"
  ></button><button class="btn btn-primary" on:click={function(){$verseCount -=1 }} style="line-height: 2rem;" disabled={$verseCount<=1}
  >-1</button><button class="btn btn-primary" on:click={function(){$verseCount +=1 }} style="line-height: 2rem;" disabled={$verseCount>chapterLength}
  >+1</button><br/><button disabled style="background: transparent;"
  ></button><button class="btn btn-primary" style="line-height: 2rem;" on:click={function(){$verse=Math.max(1,$verse-$verseCount)}} disabled={$verse <=1 }
  >⇐</button><button class="btn btn-primary" style="line-height: 2rem;" on:click={function(){$verse=Math.min($verse+$verseCount,chapterLength)}} disabled={$verse+$verseCount> chapterLength}
  >⇒</button>
</div>

<div class="preview">
  {$line1}<br/>
  {@html $line2}
</div>
{#if $bibleid2}
<div class="preview">
  {$line3}<br/>
  {@html $line4}
</div>
{/if}

<br />
<div class="settings">
  <div class="bible">
    Preklad:
    <select bind:value={$bibleid}>
      <option value="roh">Roháčkov</option>
      <option value="seb">Ekumenický</option>
      <option value="sep">Evanjelický</option>
      <option value="ssv">Katolícky</option>
      <option value="bot">Botekov</option>
      <option value="kjv">King James</option>
    </select>
  </div>
  <div class="bible">
    Preklad 2:
    <select bind:value={$bibleid2}>
      <option value="">Žiadny</option>
      <option value="roh">Roháčkov</option>
      <option value="seb">Ekumenický</option>
      <option value="sep">Evanjelický</option>
      <option value="ssv">Katolícky</option>
      <option value="bot">Botekov</option>
      <option value="kjv">King James</option>
    </select>
    {#if loadingBible}Nahráva sa preklad {$bibleid}.{/if}
  </div>

  <div class="theme">
    Téma:
    <select bind:value={$theme}>
      <option value="" selected>Predvolená</option>
      <option value="simple-with-shadow" selected>Jednoduch* s tieňom</option>
      <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
    </select>
  </div>
</div>

<style>
input,
button,
select {
  font-family: inherit;
  font-size: inherit;
  padding: 0.4em;
  margin: 0 0 0.25em 0;
  box-sizing: border-box;
  border: none;
  background: #555;
  color: whitesmoke;
  border-radius: .5rem;
}

input:disabled {
  color: #ccc;
}

button {
  color: whitesmoke;
  background-color: #555;
  font-size: 1rem;
  outline: none;
  margin: 0;
  line-height: 2rem;
  width: 3rem;
  border: 1px solid black;
  border-radius: .5rem;
}

button:active {
  background-color: #ddd;
  color: black;
}

button:focus {
  border-color: #666;
}

.control-button {
  width: 6rem;
  /* float: right; */
}

.books-filter,
.address-filter {
  display: block;
  width: 49%;
  margin: 0 1% 1rem 0;
  padding: 0;
  height: 10rem;
  overflow: scroll;
  float: left;
  max-width: 15rem;
}

.book-item,
.address-set,
.address-remove {
  width: 100%;
  margin: 0 0 .1rem;
  padding: .3rem;
  text-align: left;
  color: whitesmoke;
  border-radius: 0;
  background: black;;
}

.address-item {
  width: 100%;
  padding: 0;
  margin: 0;
  max-width: 30rem;
  display: flex;
}

.address-set {
  width: auto;
  padding: .5rem;
  margin: 0;
  text-align: left;
  flex-grow: 2;
}

.address-remove {
  margin: 0;
  max-width: 2rem;
  padding: .25rem .5rem;
  line-height: 1rem;
}

.preview {
  padding: .5rem;
}

.btn-success {
  background-color: green;
}

.btn-danger {
  background-color: red;
}

.settings {
  padding: .5rem;
}
</style>

<svelte:head>
	<title>Biblia ovládač</title>
</svelte:head>
<script type="javascript">
  import { onMount } from "svelte";
	import { writable } from 'svelte/store';
  import { page } from "$app/stores";
  import NumberPad from "$lib/NumberPad.svelte";
  import { makeWrapStore } from '$lib/wrap.js';
  import {index as roh} from "./roh.json.js"
  import {index as seb} from "./seb.json.js"
  import {index as sep} from "./sep.json.js"
  import {index as ssv} from "./ssv.json.js"
  import {index as bot} from "./bot.json.js"
  import {index as csp} from "./csp.json.js"
  import {index as kjv} from "./kjv.json.js"

  let isMounted = false;
  let bibles = {roh, seb, sep, ssv, bot, csp, kjv};
  let loadingBook = false;

  let defaultAddress = { bible: "roh", book: "gn", chapter: 1, verse: 1, verseCount: 1 };
  let bookList = [];
  let books1 = writable(new Map());
  let books2 = writable(new Map());

  let bookFilter = "";
  let shownBook;
  let lastAddresses = [defaultAddress,];
  let address = {...defaultAddress};
  let address2 = {...defaultAddress};
  let addressNext = {...defaultAddress};
  let address2Next = {...defaultAddress};
  let showNextVerses = true;
  let hideOnSelector = true;
  let line1Next = '';
  let line2Next = '';
  let line3Next = '';
  let line4Next = '';

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
  let verseNumbers = writable(false);
  let theme   = writable('');
  let bibleid = writable('roh');
  let bibleid2 = writable('');
  let allinone = writable('{}');

	onMount(() => {
    const wrapStore = makeWrapStore({
      space: 'bible',
      password: $page.url.hash.slice(1) || 'demo',
      ...Object.fromEntries($page.url.searchParams)
    });
    /* Synced variables */
    shown    = wrapStore('show', shown);
    line1    = wrapStore('line1', line1);
    line2    = wrapStore('line2', line2);
    line3    = wrapStore('line3', line3);
    line4    = wrapStore('line4', line4);
    theme    = wrapStore('theme', theme);
    bibleid  = wrapStore('bibleid', bibleid);
    bibleid2 = wrapStore('bibleid2', bibleid2);
    book     = wrapStore('book', book);
    chapter  = wrapStore('chapter', chapter);
    verse    = wrapStore('verse', verse);
    verseCount = wrapStore('verseCount', verseCount);
    verseNumbers = wrapStore('verseNumbers', verseNumbers);
    allinone = wrapStore('allinone', allinone);  /* TODO: remove */

    isMounted = true;
    return () => {};
  })

  $: address = {bible: $bibleid, book: $book, chapter: $chapter, verse: $verse, verseCount: $verseCount};
  $: address2 = {bible: $bibleid2, book: $book, chapter: $chapter, verse: $verse, verseCount: $verseCount};
  $: loadBook(address.bible, address.book, $books1, books1);
  $: $line1 = addressAsString(address, $books1);
  $: $line2 = addressContent(address, $books1, $verseNumbers);
  $: loadBook(address2.bible, address2.book, $books2, books2);
  $: $line3 = addressAsString(address2, $books2);
  $: $line4 = addressContent(address2, $books2, $verseNumbers);
  $: addressNext = nextVerse({...address});
  $: address2Next = nextVerse({...address2});
  $: line1Next = addressAsString(addressNext, $books1);
  $: line2Next = addressContent(addressNext, $books1, $verseNumbers);
  $: line3Next = addressAsString(address2Next, $books2);
  $: line4Next = addressContent(address2Next, $books2, $verseNumbers);
  $: $allinone = JSON.stringify({shown:$shown, line1:$line1, line2:$line2, line3:$line3, line4:$line4})
  $: loadBible($bibleid || 'roh', books1, true);
  $: loadBible($bibleid2, books2, false);
  $: shownBook = $books1[$book] || {chapters: {}};
  $: filteredBooks = bookFilter ? bookList.filter(matchesBook) : bookList;
  $: chapterLength = ((shownBook.chapters||{})[$chapter]||[]).length;
  $: bookLength = Object.keys(shownBook.chapters||{}).length;

  /* Disabled last address filtering
  $: filteredLastAddresses = bookFilter
    ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
    : lastAddresses;
  */

  function loadBible(bibleid, bookStore, updateBookList) {
    bookStore.update(books => {
      if (!bibleid) {
        books.clear();
        return books;
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
        // bookList = bookList;
      }
      return books;
    })
  }

  function loadBook(bibleid, abbreviation, books, bookStore) {
    if (!bibleid) return;
    if (books[abbreviation]?.chapters) return; /* already loaded */
    if (!isMounted) return;
    loadingBook = true;
    // console.log('Loading book', bibleid, abbreviation)
    fetch(`/bible/${bibleid}/${abbreviation}.json`)
    .then(response => response.json())
    .then(data => {
      bookStore.update(books => {
        books[abbreviation].chapters = data;
        return books;
      })
      loadingBook = false;
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
      verseCount: address.verseCount,
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

  function addressContent(address, books, numbers) {
    if (address === undefined || !address.bible) return '';
    var content = '';
    var book = books[address.book];
    // console.log('addressContent', bibleid, address, $books);
    if (book) {
      if (!book.chapters) {
        return content;
      }
      if (address.verse && book.chapters[address.chapter]) {
        for (var i = address.verse; i < address.verse + address.verseCount; i++) {
          content += `\n`;
          if (numbers) {
            content += `<sup>${i}</sup>`;
          }
          content += book.chapters[address.chapter][i - 1] || '';
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
      if (hideOnSelector) $shown = false;
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

  function prevVerse(address) {
    address.verse = +address.verse - address.verseCount;
    if (address.verse <= 0) {
      address = prevChapter(address);
      chapterLength = $books1[address.book].chapters[address.chapter].length;
      address.verse = chapterLength;
    }
    return address;
  };

  function nextVerse(address) {
    address.verse = +address.verse + address.verseCount;
    if (address.verse > chapterLength) {
      address = nextChapter(address);
    }
    return address;
  };

  function prevChapter(address) {
    address.chapter = +address.chapter - 1;
    if (address.chapter <= 0) {
      prevBook();
      address.chapter = Object.keys($books1[address.book].chapters||{}).length;
    }
  };

  function nextChapter() {
    address.chapter = +address.chapter + 1;
    if (address.chapter > bookLength) {
      address = nextBook(address);
      address.chapter = 1;
      address.verse = 1;
    }
  };

  function prevBook(address) {
    const newIndex = $books1[address.book].index - 1 + bookList.length;
    address.book = bookList[newIndex%bookList.length].abbreviation;
    console.log('newIndex', newIndex, $book);
    return address;
  };

  function nextBook(address) {
    const newIndex = $books1[address.book].index + 1;
    address.book = bookList[newIndex%bookList.length].abbreviation;
    return address;
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
    <button class="address-set btn" class:btn-primary={equalAddresses(addr, address)} on:click={addressSelector(addr)}>{addressAsString(addr, $books1) || (addr.book+' '+addr.chapter+','+addr.verse)}</button>
    <button class="btn btn-secondary address-remove" on:click={removeLastAddress(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Kapitola: {$chapter} z {bookLength}
  <NumberPad bind:value={$chapter} max={bookLength} />
  <button class="btn btn-primary" on:click={function(){$chapter=Math.max(1,$chapter-1)}} style="line-height: 2rem;"
  >⇦</button><button class="btn btn-primary" on:click={function(){$chapter=Math.min($chapter+1,bookLength)}} style="line-height: 2rem;"
  >⇨</button><br/><button class="control-button btn" style="line-height: 2rem;" on:click={toggleLine} class:btn-danger={$shown} class:btn-success={!$shown}
  >{#if $shown}Skryť{:else}Zobraziť{/if}</button>
</div>
<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Verš: {$verse} {#if $verseCount>1} - {$verse + $verseCount - 1}{/if} z {chapterLength}
  <NumberPad bind:value={$verse} max={chapterLength} />
  <button class="btn btn-primary" style="line-height: 2rem;" on:click={function(){$verse=Math.max(1,$verse-$verseCount)}} disabled={$verse<=1}
  >⇦</button><button class="btn btn-primary" style="line-height: 2rem;" on:click={function(){$verse=Math.min($verse+$verseCount,chapterLength)}} disabled={$verse+$verseCount>chapterLength}
  >⇨</button><br/><button disabled style="background: transparent;"
  ></button><button class="btn btn-primary" on:click={function(){$verseCount -=1 }} style="line-height: 2rem;" disabled={$verseCount<=1}
  >-1</button><button class="btn btn-primary" on:click={function(){$verseCount +=1 }} style="line-height: 2rem;" disabled={$verseCount>chapterLength}
  >+1</button><br/><button disabled style="background: transparent;"
  ></button>
</div>

<div class="preview">
  {$line1}<br/>
  {@html $line2}
</div>
{#if showNextVerses}
<div class="preview next">
  {@html line2Next}
</div>
{/if}

{#if $bibleid2}
<div class="preview">
  {$line3}<br/>
  {@html $line4}
</div>
{#if showNextVerses}
<div class="preview next">
  {@html line4Next}
</div>
{/if}
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
      <option value="csp">Český študijný</option>
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
      <option value="csp">Český študijný</option>
      <option value="kjv">King James</option>
    </select>
  </div>

  <div class="theme">
    Téma:
    <select bind:value={$theme}>
      <option value="" selected>Predvolená</option>
      <option value="simple-with-shadow" selected>Jednoduché s tieňom</option>
      <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
    </select>
  </div>

  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={$verseNumbers} /> Čísla veršov
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={showNextVerses} /> Nasledujúce verše
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={hideOnSelector} /> Skryť pri výbere knihy
    </label>
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
  user-select: none
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
  user-select: text;
}
.preview.next {
  color: #777;
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
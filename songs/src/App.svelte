<script>
  import { onMount, onDestroy } from "svelte";
  import { writableGun } from './gunstores.js';

  onMount(function(){
    document.addEventListener('keydown', function(event) {
      if (event.code == 'ArrowDown' || event.code == 'ArrowUp'
       || event.code == 'ArrowLeft' || event.code == 'ArrowRight'
      ) event.preventDefault();

      if (event.code == 'ArrowDown') {
        $curVerseIndex = Math.min($curVerseIndex+1, curVerses.length-1);
        scrollToVerse($curVerseIndex);
      } else if (event.code == 'ArrowUp') {
        $curVerseIndex = Math.max($curVerseIndex-1, 0);
        scrollToVerse($curVerseIndex);
      } else if (event.code == 'ArrowLeft') {
        $curSongIndex = Math.max($curSongIndex-1, 0);
      } else if (event.code == 'ArrowRight') {
        $curSongIndex = Math.min($curSongIndex+1, playlist.length-1);
      }
    });
  });

  let songs = [
    {
      name: "A Safe Stronghold Our God is Still",
      author: "Martin Luther",
      order: "s1 s2 s3 s1 s1 s2 s3 s3 s3",
      verses: {
        s1: `As safe a stronghold our God is still,
On earth is not His fellow.`,
        s2: `With force of arms we nothing can,
Shall conquer in the battle.`,
        s3: `And were this world all devils o’er,
A word shall quickly slay him.`
      }
    }
  ];
  let songsByName = new Map();
  let songFilter = "";
  let filteredSongs = songs;
  let filterFocused = false;

  GUN_SUPER_PEERS = GUN_SUPER_PEERS || ['http://127.0.0.1/gun'];
  let gun = Gun(GUN_SUPER_PEERS);
  let overlay = gun.get('songs').get(window.location.hash || 'demo');

  /* Synced variables */
  let shown = writableGun(overlay.get('show'), false);
  let line1 = writableGun(overlay.get('line1'), '');
  let bodyclass = writableGun(overlay.get('bodyclass'), '');
  let curSongIndex = writableGun(overlay.get('curSongIndex'), 0);
  let curVerseIndex = writableGun(overlay.get('curVerseIndex'), 0);

  let playlist = [
    songs[0],
  ];
  let curSong = playlist[0];
  let curVerses = curSong.verses || [];

  $: curSong = playlist[$curSongIndex || 0];
  $: curVerses = getSongVerses(curSong);
  $: $line1 = curVerses[$curVerseIndex];
  $: filteredSongs = songFilter ? songs.filter(matchesSong) : songs;

  function getSongVerses(song) {
    let verses = [];
    song && song.order.split(' ').forEach(id => {
      if (song.verses[id]) {
        verses.push(song.verses[id]);
      }
    });
    return verses;
  }

  function matchesSong(song) {
    const prefix = songFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nameLower = song.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      nameLower.startsWith(prefix) ||
      (prefix.length >= 2 && nameLower.includes(' '+prefix))
    );
  }

  function addToPlaylist(song) {
    playlist.push(song);
    playlist = playlist;
  }

  function playlistRemover(songIndex) {
    return function() {
      playlist = playlist.filter((h, j) => (songIndex !== j));
    }
  }

  function songSelector(i) {
    return function() {$curSongIndex = i}
  }

  function verseSelector(i) {
    return function() {$curVerseIndex = i}
  }

  function scrollToVerse(i) {
    let e = document.querySelector('.verse-item:nth-child('+i+')');
    e && e.scrollIntoView();
  }

  function toggleShow() {
    shown = !shown;
    overlay.get('show').put(shown);
  }
</script>

<style>
  :global(body) {
    color: white;
  }
  .control-button {
    width: 6rem;
  }
  .songs-filter {
    display: block;
    margin: 0;
    padding: 0;
    width: 100%;
    max-height: calc(100vh - 6rem);
    position: absolute;
    left: -100%;
    overflow: scroll;
    z-index: 30;
  }
  .songs-filter.show {
    left: 0;
  }
  .songs-filter .song-item {
    padding: .75rem .5rem;
  }

  .song-item {
    width: 100%;
    margin: 0;
    padding: 0;
    text-align: left;
    border: 1px solid black;
  }
  .song-item:hover {
    border: 1px solid blue;
  }
  .playlist {
    display: inline-block;
    overflow: auto;
    vertical-align: top;
    width: 100%;
    margin: 1rem 0;
  }
  .song-set {
    width: auto;
    padding: 0 .75rem;
    margin: 0;
    text-align: left;
  }
  .song-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
  }

  .verses {
    display: inline-block;
    overflow: auto;
    width: 100%;
    /* max-height: calc(100vh - 5.6rem); */
  }
  .verse-item {
    border-bottom: 1px solid;
    border-color: #3c3b3b;
    padding: .5rem .5rem;
    margin: 0;
    width: 100%;
  }
  .verse-item:hover {
    border-color: wheat;
  }
  .verse-item.active {
    border-color: yellow;
    color: white;
    background: #375a7f;
  }
  .verse-item:last-child {
    border-bottom: none;
  }
  button {
    margin: 0;
    padding: 1rem 0.25rem;
  }
  .bottom-buttons {
    position: sticky;
    bottom: 0;
    left: 0;
    width: 100%;
  }
</style>

<p class="bodyclass">
  Téma:
  <select bind:value={$bodyclass}>
    <option value="" selected>Predvolené</option>
    <option value="simple-with-shadow">Jednoduché s tieňom</option>
  </select>
</p>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter"
    bind:value={songFilter}
    on:focus={()=>{filterFocused=true}}
    />
  <button type="button" class="form-control btn btn-secondary"
    style="max-width: 2rem; padding: .25rem;"
    on:click={()=>{songFilter=''}}
    >×</button>
</div>

<div class="songs-filter" class:show={filterFocused}>
  {#each filteredSongs as song}
    <button class="song-item btn"
      class:btn-primary={song==curSong}
      on:click={()=>{addToPlaylist(song); filterFocused=false}}
    >{song.name}</button>
  {/each}
</div>

<div class="playlist">
  Playlist:
  {#each playlist as song, i}
  <div class="song-item btn-group">
    <button class="song-set btn"
      class:btn-primary={$curSongIndex==i}
      on:click={songSelector(i)}
      >{song.name||'--'}</button>
    <button class="btn btn-secondary song-remove" on:click={playlistRemover(i)}>×</button>
  </div>
  {/each}
</div>

<div class="verses">
  Verše:
  {#each curVerses as verse, i}
    <p class="verse-item" class:active={$curVerseIndex==i} on:click={verseSelector(i)}>
    {@html verse.replace(/\n/g,'<br>')}
    </p>
  {/each}
</div>

<div class="bottom-buttons btn-group">
  <button class="btn btn-primary"
          on:click={function(){$curSongIndex -= 1}}
          disabled={$curSongIndex <= 0}>↑ Pieseň</button>
  <button class="btn btn-primary"
          on:click={function(){$curSongIndex += 1}}
          disabled={$curSongIndex >= playlist.length-1}>Pieseň ↓</button>

  <button class="control-button btn" on:click={toggleShow} class:btn-danger={shown} class:btn-success={!shown}>
    {#if shown}Skryť{:else}Zobraziť{/if}
  </button>

  <button class="btn btn-primary"
          on:click={function(){$curVerseIndex -= 1; scrollToVerse($curVerseIndex)}}
          disabled={$curVerseIndex <= 0}>↑ Verš</button>
  <button class="btn btn-primary"
          on:click={function(){$curVerseIndex += 1; scrollToVerse($curVerseIndex)}}
          disabled={$curVerseIndex >= curVerses.length-1}>Verš ↓</button>
</div>

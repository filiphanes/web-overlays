<script>
  import { onMount, onDestroy } from "svelte";

  onMount(function(){
    document.addEventListener('keydown', function(event) {
      if (event.code == 'ArrowDown' || event.code == 'ArrowUp'
       || event.code == 'ArrowLeft' || event.code == 'ArrowRight'
      ) event.preventDefault();

      if (event.code == 'ArrowDown') {
        curVerseIndex = Math.min(curVerseIndex+1, curVerses.length-1);
        scrollToCurrentVerse();
      } else if (event.code == 'ArrowUp') {
        curVerseIndex = Math.max(curVerseIndex-1, 0);
        scrollToCurrentVerse();
      } else if (event.code == 'ArrowLeft') {
        curSongIndex = Math.max(curSongIndex-1, 0);
      } else if (event.code == 'ArrowRight') {
        curSongIndex = Math.min(curSongIndex+1, playlist.length-1);
      }
    });
  });

  /* Synced variables */
  let shown = false;
  let line1 = '';
  let line2 = '';
  let bodyclass = '';
  
  let songs = [
    {
      name: "A Safe Stronghold Our God is Still",
      author: "Martin Luther",
      order: "s1 s2 s3 s1 s1 s2 s3 s3 s3",
      verses: {
        s1: `As safe a stronghold our God is still,
A trusty shield and weapon;
He’ll help us clear from all the ill
That hath us now o’ertaken.
The ancient prince of hell
Hath risen with purpose fell;
Strong mail of craft and power
He weareth in this hour;
On earth is not His fellow.`,
        s2: `With force of arms we nothing can,
Full soon were we down-ridden;
But for us fights the proper Man,
Whom God Himself hath bidden.
Ask ye: Who is this same?
Christ Jesus is His name,
The Lord Sabaoth’s Son;
He, and no other one,
Shall conquer in the battle.`,
        s3: `And were this world all devils o’er,
And watching to devour us,
We lay it not to heart so sore;
Not they can overpower us.
And let the prince of ill
Look grim as e’er he will,
He harms us not a whit;
For why? his doom is writ;
A word shall quickly slay him.`
      }
    }
  ];
  let songsByName = new Map();
  let songFilter = "";
  let filteredSongs = songs;

  let playlist = [
    songs[0],
  ];
  let curSongIndex = 0;
  let curSong = playlist[curSongIndex];
  let curVerses = curSong.verses || [];
  let curVerseIndex = 0;
  let curVerse;
  

  GUN_SUPER_PEERS = GUN_SUPER_PEERS || ['http://127.0.0.1/gun'];
  let gun = Gun(GUN_SUPER_PEERS);
  let overlay = gun.get('songs').get(window.location.hash || 'demo');
  overlay.get('show').on(function(data, key){shown = data});
  let overlaySong = overlay.get('song');
  overlaySong.on(function(data, key){curSong[key] = data});
  let overlayLine1 = overlay.get('line1');
  overlayLine1.on(function(data){line1 = data});
  let overlayLine2 = overlay.get('line2');
  overlayLine2.on(function(data){line2 = data});
  let overlayBodyClass = overlay.get('bodyclass');
  overlayBodyClass.on(function(data){bodyclass = data});

  $: curSong = playlist[curSongIndex];
  $: curVerses = getSongVerses(curSong);
  $: curVerse = curVerses[curVerseIndex];
  $: overlaySong.put(curSongIndex);
  $: overlayLine1.put(curVerse);
  // $: overlayLine2.put(addressContent(curSongIndex));
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
    return function() {curSongIndex = i}
  }

  function verseSelector(i) {
    return function() {curVerseIndex = i}
  }

  function scrollToCurrentVerse() {
    document.querySelector('.verse-item:nth-child('+curVerseIndex+')').scrollIntoView();
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
    /* float: right; */
  }
  .songs-filter {
    display: block;
    width: 100%;
    margin: 0 1% 0 0;
    padding: 0;
    max-height: 10rem;
    max-width: 30rem;
    overflow: scroll;
  }
  .song-item {
    width: 100%;
    margin: 0 0 .25rem 0;
    padding: 0 .5rem;
    text-align: left;
  }
  .song-item {
    width: 100%;
    margin: 0 0 .25rem 0;
    max-width: 30rem;
  }
  .song-set {
    width: auto;
    padding: 0 .5rem;
    margin: 0;
    text-align: left;
  }
  .song-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
  }
  .verse-item {
    padding: .25rem .5rem;
    margin: 0;
  }
  button {
    margin: 0;
    line-height: 2rem;
  }
</style>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={songFilter} />
  <button type="button" class="form-control btn btn-secondary" on:click={()=>{songFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="songs-filter">
  {#each filteredSongs as song}
    <button class="song-item btn" class:btn-primary={song==curSong} on:click={()=>addToPlaylist(song)}>{song.name}</button>
  {/each}
</div>

<div class="playlist">
  Playlist:<br>
  {#each playlist as song, i}
  <div class="song-item btn-group">
    <button class="song-set btn" class:btn-primary={curSongIndex==i} on:click={songSelector(i)}>{song.name||'--'}</button>
    <button class="btn song-remove" on:click={playlistRemover(i)}>×</button>
  </div>
  {/each}
</div>

<div class="verses">
  {#each curVerses as verse, i}
    <p class="verse-item" class:btn-primary={curVerseIndex==i} on:click={verseSelector(i)}>
    {@html verse.replace(/\n/g,'<br>')}
    </p>
  {/each}
</div>

<div style="display: inline-block; margin: 0 .5rem 0 0; vertical-align: top;">
  <button class="control-button btn" on:click={toggleShow} class:btn-danger={shown} class:btn-success={!shown}>
    {#if shown}Skryť{:else}Zobraziť{/if}
  </button>
</div>
<div style="display: inline-block;">
  <button class="btn btn-primary"
          on:click={function(){curSongIndex -= 1}}
          disabled={curSongIndex <= 0}>Predošlá pieseň</button>
  <button class="btn btn-primary"
          on:click={function(){curSongIndex += 1}}
          disabled={curSongIndex >= playlist.length-1}>Ďalšia pieseň</button>

  <button class="btn btn-primary"
          on:click={function(){curVerseIndex -= 1}}
          disabled={curVerseIndex <= 0}>Predošlý verš</button>
  <button class="btn btn-primary"
          on:click={function(){curVerseIndex += 1}}
          disabled={curVerseIndex >= curVerses.length-1}>Ďalší verš</button>
</div>

<p class="bodyclass">
  Téma:
  <select bind:value={bodyclass} on:change="{() => overlayBodyClass.put(bodyclass)}">
    <option value="" selected>Predvolené</option>
    <option value="simple-with-shadow">Jednoduché s tieňom</option>
    <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
  </select>
</p>

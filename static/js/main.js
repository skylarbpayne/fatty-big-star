// Static settings variables
var DEBUG = true,  // toggle this variable
    GAME_WIDTH = 800,
    GAME_HEIGHT = 600,
    GROUND_HEIGHT = 128,
    PATRICK_VELOCITY_X = 300,
    PATTY_SPEED_BOOST = 350,
    ENERGY_CAP = 750,
    ALTITUDE_CHUNK = 4000,
    GAME_TEXT = 'Lucida Grande',
    BLACK_HEX = '#000',
    GREEN_HEX = '#83F52C';

var game = new Phaser.Game(
        GAME_WIDTH,
        GAME_HEIGHT,
        Phaser.AUTO,
        'game_box',
        { preload: preload,
            create: create,
    update: update }
    );

var DIPLOMACY = {
    OBSTACLE: 0,
    POWERUP: 1,
    NEUTRAL: 2
};

var ENTITY_VALUE_MAP = {
    'patty': {
        // starting coeffs, dynamically modified as game progresses
        // powerups start at a high frequency and decrease
        SPAWN_RATE: 50,  
        // for powerups, there's a min frequency (it's dropping)
        RATE_CAP: 65,
        DIPLOMACY: DIPLOMACY.POWERUP
    },
    'jellyfish': {
        // obstacles start at a low frequency and increase
        SPAWN_RATE: 150,
        // for obstacles, there's a max frequency (it's rising)
        RATE_CAP: 25,
        DIPLOMACY: DIPLOMACY.OBSTACLE
    },
    'shark': {
        SPAWN_RATE: 200,
        RATE_CAP: 75,
        DIPLOMACY: DIPLOMACY.OBSTACLE

    },
    'squid': {
        SPAWN_RATE: 5400,
        RATE_CAP: 1000,
        DIPLOMACY: DIPLOMACY.OBSTACLE
    },
    'bubble': {
        SPAWN_RATE: 30,
        DIPLOMACY: DIPLOMACY.NEUTRAL
    },
    'shield': {
        SPAWN_RATE: 900,
        RATE_CAP:  1400,
        DIPLOMACY: DIPLOMACY.POWERUP
    }
};


// Load static assets
function preload() {
    game.load.image('ocean', 'static/imgs/undersea.jpg');
    game.load.image('black_bg', 'static/imgs/game_over.png');
    game.load.image('ground', 'static/imgs/platform.png');
    game.load.image('patty', 'static/imgs/patty.png');
    game.load.image('bubble', 'static/imgs/bubble.png');
    game.load.image('energy_bar', 'static/imgs/energy_bar.png');
    game.load.image('empty_energy_bar', 'static/imgs/empty_energy_bar.png');
	game.load.image('clam', 'static/imgs/clam.png');
    game.load.image('sound_off_button', 'static/imgs/turn_off_sound.png');
    game.load.image('sound_on_button', 'static/imgs/turn_on_sound.png');
    game.load.image('golden_bubble', 'static/imgs/golden_bubble.png');

    game.load.spritesheet('patrick', 'static/imgs/patrick_sprites.png', 46, 54);
    game.load.spritesheet('patrick_falling', 'static/imgs/patrick_falling_sprites.png', 45, 53);
    game.load.spritesheet('jellyfish', 'static/imgs/jellyfish_sprites.png', 29, 25);

    game.load.spritesheet('aura_good', 'static/imgs/powerup_sprite.png', 192, 192);
    game.load.spritesheet('shark', 'static/imgs/sharks.png', 103,45);
    game.load.spritesheet('squid', 'static/imgs/squidsheet.png', 49, 121);
    game.load.spritesheet('ink', 'static/imgs/ink.png', 600, 600);

    game.load.audio('background_music', ['static/sounds/485299_Underwater-Grotto-T.mp3']);
}


var _____,

    // Physics varaibles
    speed = 0,
    acceleration = 0,
    altitude = 0,
    energy = 0,
    patty_boost_timer = 0,
    // Every 4000 altitude, the game gets 'harder', powerups and patties
    // are spawned rarer while obstacles are spawned more frequently
    // This # was chosen b/c 4000 altitude gets traversed every few seconds
    altitude_checkmark = ALTITUDE_CHUNK,
    final_altitude = 0,

    // Entity groups
    player,
    platforms,
    patties,
    jellyfishes,
    cursors,
    bubbles,
    aura,
    sharks,
    energy_bar,
    inks,
    squids,
	clams,
    bubble_shields,
    shield,

    // Text
    altitude_text,
    energy_text,

    //Timer,
    squid_timer,

    // Music
    bg_music,

    //Flags
    facing_right = true,
    game_ended = false,
    in_shield = false,

    // Time and interval variables
    starting_time,
    elapsed,
    milliseconds = 0,
    seconds = 0;


/*
 * Called on every game update(), updates the counters for
 * ingame seconds, elapsed time, and milliseconds. Important
 * because the time variables are used in game physics calculations.
 */
function update_timer() {
    seconds = Math.floor(game.time.time / 1000);
    milliseconds = Math.floor(game.time.time);
    elapsed = game.time.time - starting_time;
}


/*
 * NOTE: Entities are rendered in the order in which their
 * sprites and groups are declared. e.g. `inks` is intentionally
 * at the very end because we want the ink to be displayed over
 * other other entities.
 *
 */
function create() {
    // Enable physics for in-game entities
    game.physics.startSystem(Phaser.Physics.ARCADE);

    // Add background sound
    bg_music = game.add.audio('background_music');
    if (!DEBUG) {
        bg_music.play();
    }

    // Add ocean background
    game.add.sprite(0, 0, 'ocean');

    platforms = game.add.group();
    // Enable physics for any object created in this group
    // Note that the sky has no physics enabled
    platforms.enableBody = true;
    // The first platform is just the ground
    var ground = platforms.create(
            0,
            game.world.height - GROUND_HEIGHT,
            'ground');

    // Scale it to fit the width of the game
    // (the original sprite is 400x32 in size)
    ground.scale.setTo(2, 4);

    // `body.immovable` set prevents movement after two
    // this object collides with another
    ground.body.immovable = true;

    // Add the main avatar, Patrick!
    player = game.add.sprite(
            game.world.width / 2,
            game.world.height - 150,
            'patrick');
    game.physics.arcade.enable(player);
    player.body.immovable = true;
    player.body.collideWorldBounds = true;

    player.animations.add('swimming',
                          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                          60,
                          true);
    player.animations.add('falling',
                          [11, 12, 13],
                          30,
                          true);
    player.animations.add('walking',
                          [14, 15, 16, 17, 18, 19, 20, 21, 22],
                          25,
                          true);

    player.animations.play('swimming');
    player.anchor.setTo(0.5, 0.5);

    aura = game.add.sprite(50, 50, 'aura_good');
    aura.animations.add('revive', 
            [0, 1, 2, 3, 4, 5, 6, 7,
            8, 9, 10, 11, 12]);

    aura.scale.setTo(0.5, 0.5);
    aura.anchor.setTo(0.5, 0.5);
    aura.exists = false;

    shield = game.add.sprite(0,0, 'golden_bubble');
    shield.exists = false;
    shield.scale.setTo(0.43, 0.43);
    shield.anchor.setTo(0.43, 0.43);
	
    jellyfishes = game.add.group();
    jellyfishes.enableBody = true;

    squids = game.add.group();
    squids.enableBody = true;

    patties = game.add.group();
    patties.enableBody = true;

    sharks = game.add.group();
    sharks.enableBody = true;

    bubbles = game.add.group();
    bubbles.enableBody = true;

    inks = game.add.group();
    inks.enableBody = true;
	
	clams = game.add.group();
	clams.enableBody = true;
	
    bubble_shields = game.add.group();
    bubble_shields.enableBody = true;

    // Initial patty on ground to give Patrick a boost
    var first_patty = patties.create(
            0.5 * game.world.width - 20,
            10, 
            'patty');
    first_patty.scale.setTo(0.4, 0.4);
    first_patty.body.gravity.y = 600;
	
    add_sound_control_button();
	
    empty_energy_bar = game.add.sprite(game.width - (216 + 10), 10,
            'empty_energy_bar');
    empty_energy_bar.scale.setTo(1, 0.5);

    energy_bar = game.add.sprite(game.width - (216 + 10), 10,
            'energy_bar');
    energy_bar.scale.setTo(1, 0.5);

    altitude_text = game.add.text(
            10, 
            10,
            'Altitude: 0', 
            { font: '20px ' + GAME_TEXT,
                fill: BLACK_HEX }
            );

    energy_text = game.add.text(
            game.width - (212/2 + 20), 
            12,
            '0%', 
            { font: '11px ' + GAME_TEXT,
                fill: GREEN_HEX }
            );

    starting_time = game.time.time;
    elapsed = game.time.time - starting_time;

    // Controls
    cursors = game.input.keyboard.createCursorKeys();
	
}

function add_sound_control_button() {
    sound_off_button = game.add.sprite(game.width - 50, 40, 'sound_off_button');
    sound_off_button.width = 25;
    sound_off_button.height = 25;
	
    sound_on_button = game.add.sprite(game.width - 50, 40, 'sound_on_button');
    sound_on_button.width = 0;
    sound_on_button.height = 25;

    sound_off_button.inputEnabled = true;
    sound_on_button.inputEnabled = true;

    sound_off_button.events.onInputDown.add(sound_off, this);
    sound_on_button.events.onInputDown.add(sound_on, this);
}

function sound_off() {
    bg_music.volume = 0;
    sound_off_button.width = 0;
    sound_on_button.width = 25;
}

function sound_on() {
    bg_music.volume = 1;
    sound_off_button.width = 25;
    sound_on_button.width = 0;
}

/*
 * This function uses the current altitude and entity name
 * to generate a frequency of spawn for said entity. This coeff
 * is then used to modulus against the game timer, a larger
 * coeff maens rarer spawn times.
 */
function set_spawn_rate(entity_name) {
    if (altitude <= altitude_checkmark) {
        return;
    }
    altitude_checkmark += ALTITUDE_CHUNK;
    var rate_delta = 1;

    var entity = ENTITY_VALUE_MAP[entity_name];

    if (entity.DIPLOMACY === DIPLOMACY.OBSTACLE) {
        // obstacles get more frequent
        entity.SPAWN_RATE = Math.max(
            entity.SPAWN_RATE - rate_delta, entity.RATE_CAP);
    } else if (entity.DIPLOMACY === DIPLOMACY.POWERUP) {
        // powerups start at a high rate and lose frequency
        entity.SPAWN_RATE = Math.min(
            entity.SPAWN_RATE + rate_delta, entity.RATE_CAP);
    } else if (entity.DIPLOMACY === DIPLOMACY.NEUTRAL) {
        // do nothing
    }
}


/*
 * Inputs a number and returns the same number but
 * with a little subtracted or added to it. "A little"
 * here means a small percentage of the number itself
 */
function fuzz_number(number) {
    var percentage_num = Math.ceil(number * 0.30);
    var rand_coeff = Math.random() * percentage_num;
    if (Math.random() > 0.5) {
        rand_coeff *= -1;
    }
    return Math.ceil(number + rand_coeff);
}

/*
function add_krabby_patty() {
    var patty = patties.create(
            Math.floor(Math.random() * game.world.width),
            0,
            'patty');
    patty.checkWorldBounds = true; 
    patty.outOfBoundsKill = true;
    patty.scale.setTo(0.4, 0.4);
}
*/

function add_varied_patties(n) {
	var variance = 100;
	var x_start = Math.floor(Math.random() * (game.world.width - variance));
	var y = Math.floor(Math.random() * 100);
	for(var i  = 0; i < n; ++i) {
		var x = Math.floor(x_start + variance * (2 * Math.random() - 1));
		var patty = patties.create(x, y, 'patty');
		patty.checkWorldBounds = true;
		patty.outOfBoundsKill = true;
		patty.scale.setTo(0.4, 0.4);
		y += patty.height + Math.floor(Math.random() * 2 * variance);
	}
}

function add_sin_patties(n) {
	var a = 100 + Math.floor(100 * Math.random());
	var x_start = Math.floor(Math.random() * (game.world.width - a));
	var x = x_start;
	var y = Math.floor(Math.random() * 100);
	for(var i = 0; i < n; ++i) {
		var patty = patties.create(x, y, 'patty');
		patty.checkWorldBounds = true;
		patty.outOfBoundsKill = true;
		patty.scale.setTo(0.4, 0.4);
		x = x_start + Math.sin(2 * Math.PI * i / n);
		y += Math.floor(Math.random() * 200) + patty.height;
	}
}

function add_step_patties(n) {
	var step = 100 + Math.floor(100 * Math.random());
	var x_start = Math.floor(Math.random() * game.world.width);
	var y_start = Math.floor(100 * Math.random());
	for(var i = 0; i < n; ++i) {
		var patty = patties.create(x_start + step * i, y_start + step * i, 'patty');
		patty.checkWorldBounds = true;
		patty.outOfBoundsKill = true;
		patty.scale.setTo(0.4, 0.4);
	}
}

var patterns = [add_varied_patties, add_sin_patties, add_step_patties];

function add_patty_group() {
	//add patties in a "line group"
	//group should have a random center/start
	//each one moves up and to the left or right a little from the "center"
	//random number of patties generated in this patterns
	var range_patties = 7;
	var offset = 3;

	var num_patties = Math.floor(Math.random() * range_patties + offset);
	var p = Math.floor(Math.random() * patterns.length);
	patterns[p](num_patties);
}


/*
 * Some entities are different, we want to add them in groups
 * instead of randomlly spread out
 */
function add_grouped(entity_name) {
    var variance_mapping = {
        'bubble': 100,
        'jellyfish': 250
    };
    var spawn_mapping = {
        'bubble': add_bubble,
        'jellyfish': add_jellyfish
    }
    var max_mapping = {
        'bubble': 50,
        'jellyfish': 20
    }

    var x_coord = Math.floor(Math.random() * game.world.width);
    var y_coord = 0;
    var n = Math.floor(4 + (Math.random() * max_mapping[entity_name]));

    for (var i = 0; i < n; i++) {
        var pos_neg = Math.random() <= 0.5 ? -1 : 1;
        var x_variance = pos_neg * Math.random() * variance_mapping[entity_name];
        var y_variance = -1 * Math.random() * variance_mapping[entity_name];

        spawn_mapping[entity_name](
            x_coord + x_variance, y_coord + y_variance);
    }
}


function add_bubble(x_coord, y_coord) {
    var bubble = bubbles.create(x_coord, y_coord, 'bubble');

    bubble.body.bounce.y = 0.9 + Math.random() * 0.2;
    bubble.checkWorldBounds = true; 
    bubble.outOfBoundsKill = true;
    // rotate the bubble for a cool effect

    // bubbles should vary in size, but should be on the smaller
    // end because we have shitty sprites
    var size_variance = 0.1 + (Math.random() * 0.5);
    bubble.scale.setTo(size_variance, size_variance);
    bubble.angle = Math.floor(181 * Math.random());
}


function add_jellyfish(x_coord, y_coord) {
    var jelly = jellyfishes.create(x_coord, y_coord, 'jellyfish');

    jelly.body.bounce.y = 0.7 + Math.random() * 0.2;
    jelly.checkWorldBounds = true; 
    jelly.outOfBoundsKill = true;
    jelly.animations.add('swim', [0, 1, 2, 3], 12, true);
    jelly.animations.play('swim');
    jelly.oscl_coef = Math.random() * (100) + 200;
    jelly.x_speed = jelly.oscl_coef - 100;
    // Start each jellyfish at a random animation to look more real
    jelly.animations.currentAnim.frame = Math.floor(Math.random() * 3);
}


function add_shark() {
    var y_coord = 300;
    var coin = (Math.random() <= 0.5) ? -1 : 1;
    var x_coord = (coin === -1) ? GAME_WIDTH : 0;
	var shark = sharks.create(x_coord, y_coord, 'shark');

    shark.anchor.setTo(0.5, 1);
    shark.scale.x = coin;
	shark.side = coin;		
    shark.checkWorldBounds = true; 
    shark.outOfBoundsKill = true;
    shark.animations.add('swim', [0, 1, 2], 12, true);
    shark.animations.play('swim');

    shark.animations.currentAnim.frame = 
                        Math.floor(Math.random() * 2);
}


function add_clam() {
	var clam = clams.create(player.x - 22.8, 0, 'clam');
	clam.checkWorldBounds = true;
	clam.outOfBoundsKill = true;
}


function add_bubble_shield() {
    var shield = bubble_shields.create(Math.random() * 650, 0, 'golden_bubble');
    shield.checkWorldBounds = true;
    shield.outOfBoundsKill = true;
    shield.scale.setTo(0.43, 0.43);
}


function add_ink() {
    var ink = inks.create(player.x - 300, -200, 'ink');

    ink.checkWorldBounds = true;
    ink.outOfBoundsKill = true;
    ink.animations.add('show', [0] , 12, true);
    ink.animations.play('show');
}


function add_squid(x_coord, y_coord) {
    var squid = game.add.sprite(x_coord, y_coord, 'squid');
    squid.inputEnabled = true;

    squid.events.onInputDown.add(clicked, this);
    squid.events.onAddedToGroup.add(added_squid, this);
    squid.events.onOutOfBounds.add(squid_left, this);
    squids.add(squid);
    squid.checkWorldBounds = true;
    squid.outOfBoundsKill = true;
    squid.animations.add('swim', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 12, true);
    squid.animations.play('swim');

}


function squid_left() {
    game.time.events.remove(squid_timer);
    squid_timer = undefined;
}


function clicked(sprite) {
    console.log("Clicked squid");
    sprite.destroy();
    game.time.events.remove(squid_timer);
    squid_timer = undefined;
}


function added_squid(){
    console.log("added a squid");
    if (squid_timer === undefined) {
        squid_timer = game.time.events.loop(
                Phaser.Timer.SECOND * 2.5 , add_ink, this);
    }

}


function numberWithCommas(n) {
    var parts=n.toString().split(".");
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                            (parts[1] ? "." + parts[1] : "");
}


function update_physics() {
    // Update aura positions to patrick, this should be done elsewhere!
    aura.x = player.x;
    aura.y = player.y;

    shield.x = player.x;
    shield.y = player.y;

    if (in_shield) {
        shield.exists = true;
    } else {
        shield.exists = false;
    }
	
    platforms.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.y = acceleration;
    }, this);

    jellyfishes.forEach(function(item) {
        item.body.velocity.x = item.x_speed;
        item.body.velocity.y = item.oscl_coef * Math.sin(game.time.now / 100) + speed;
    }, this);

    bubbles.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.y = acceleration;
        item.angle = item.angle + ((Math.random() <= 0.5) ? 1 : -1);
    }, this);

    sharks.forEach(function(item) {
        item.body.velocity.x = 700 * item.side;
        item.body.acceleration.x = 1000 * item.side;
        if (speed < 0 || acceleration < 0) {
            item.body.acceleration.y = -500;
            item.body.velocity.y = -500;
        } else {
            item.body.velocity.y = 0;
            item.body.acceleration.y = 0;
        }
    }, this);

    patties.forEach(function(item) {
        // first patty has acceleration
        if (item.body.gravity.y === 0) {
            item.body.velocity.y = speed;
        }
        item.body.acceleration.y = acceleration;
    }, this);

    inks.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.y = acceleration;
    }, this);

    clams.forEach(function(item) {
        item.scale.setTo(0.4, 0.4);
        item.body.velocity.y = speed * 2;
        item.body.acceleration.y = acceleration;
        item.body.gravity.y = 300;
        if (speed < 0 || acceleration < 0) {
            item.body.velocity.y = 400;
            item.body.acceleration.y = 200;
            item.body.gravity.y = 150;
        }
    }, this);	

    bubble_shields.forEach(function(item) {
        item.body.velocity.y = speed * 1.5;
        item.body.acceleration.y = acceleration;
        item.body.gravity.y = 150;
        if (speed < 0 || acceleration < 0) {
            item.body.velocity.y = 400;
            item.body.acceleration.y = 200;
            item.body.gravity.y = 150;
        }
    }, this);
	
    squids.forEach(function(item) {
        // Fix squid physics effect. Squids are unique because they 
        // are naturally floating upwards, not downwards.
    
        // If our speed is negative (falling) the squid should quickly
        // zoom up, not the before action (fall down slowly)
        var speed_coeff = -1;
        if (speed > 0) {
            speed_coeff = -0.1;
        }
        item.body.velocity.y = speed_coeff  * speed;
    }, this);

    // Game over when Patrick has been falling for a little bit
    // Safe assumption because all entities are killed after
    // they fall off the map, Patrick has no way of getting up
    if (speed < -1500 || altitude < 0) {
        if (!game_ended)
            game_over();
    }

    // Exhaust effect of patties so they don't last forever
    if (energy > 0) {
        speed = 400;
        if (patty_boost_timer > 0) {
            speed = speed + PATTY_SPEED_BOOST;
            patty_boost_timer--;
        }
        energy--;
    } else if (altitude > 0) {
        speed -= 30;
    }

    altitude += Math.floor(speed * (1/60));

    // Reset the player's horiz velocity (movement)
    player.body.velocity.x = 0;
}


/*
 * IMPORTANT: Because the update function's contents vary in
 * functionality and depend on each other, the separate functions
 * must be divided in sequences.
 *
 * 1. Update all game clocks
 * 2. Check for all collisions
 * 3. Insert or delete entities
 * 4. Update physics
 * 5. Update user inputs
 * 7. Update text & counters
 */
function update() {
    // ================================
    // ==== Update all game clocks ====
    // ================================
    update_timer();

    // ==============================
    // ==== Check for collisions ====
    // ==============================
	game.physics.arcade.collide(clams, platforms);
    game.physics.arcade.collide(jellyfishes, platforms);
    game.physics.arcade.collide(patties, platforms);
    game.physics.arcade.collide(player,
		patties,
		collect_patty,
		null,
		this);
    game.physics.arcade.overlap(player,
		jellyfishes,
		hit_jellyfish,
		null,
		this);
	game.physics.arcade.overlap(player,
		clams,
		hit_clam,
		null,
		this);
    game.physics.arcade.overlap(player,
        sharks,
        hit_shark,
        null,
        this);
	game.physics.arcade.overlap(player,
		bubble_shields,
		hit_shield,
		null,
		this);
		
		
    // ===============================
    // ==== Add & delete entities ====
    // ===============================

    if (game.time.time % 4 === 0) {
        var entities = Object.keys(ENTITY_VALUE_MAP);
        for (var i = 0; i < entities.length; i++) {
            set_spawn_rate(entities[i]);
        }
    }

    var jelly_rate = fuzz_number(ENTITY_VALUE_MAP['jellyfish'].SPAWN_RATE);
    if (game.time.time % jelly_rate === 0 && altitude > 0) {
        add_grouped('jellyfish');
    }

    var patty_rate = fuzz_number(ENTITY_VALUE_MAP['patty'].SPAWN_RATE);
    if (game.time.time % patty_rate === 0 && altitude > 0) {
    	add_patty_group();
    }

    var shark_rate = fuzz_number(ENTITY_VALUE_MAP['shark'].SPAWN_RATE);
    if (game.time.time % shark_rate === 0 && altitude > 0) {
        add_shark();
        add_clam();
    }

	var shield_rate = fuzz_number(ENTITY_VALUE_MAP['shield'].SPAWN_RATE);
	if (game.time.time % shield_rate === 0 && altitude > 0) {
		add_bubble_shield();
    }

    var squid_rate = fuzz_number(ENTITY_VALUE_MAP['squid'].SPAWN_RATE);
    if (altitude % squid_rate === 0  && altitude > 999) {
        add_squid(50 + Math.floor(Math.random() * 650), 600);
    }

    var bubble_rate = fuzz_number(ENTITY_VALUE_MAP['bubble'].SPAWN_RATE);
    // bubbles are background objects, no dynamic changing spawn rate
    // (10 + Math.floor(Math.random() * 65))
    if (game.time.time % bubble_rate === 0 && altitude > 0) {
        add_grouped('bubble');
    }

    if (DEBUG && game.time.time % 16 === 0) {
        console.log('patty rate ' + ENTITY_VALUE_MAP['patty'].SPAWN_RATE +
            ' ' + patty_rate);
    }

    // ==================
    // ===== Physics ====
    // ==================

    update_physics();

    // ====================
    // ==== Controller ====
    // ====================

    var walking = altitude === 0;
    var falling = (speed <= 0 && altitude > 0);
    var swimming = (speed > 0 && altitude > 0); 

    if (swimming) {
        player.animations.play('swimming');
    } else if (walking) {
        player.animations.play('walking');
    } else if (falling) {
        player.animations.play('falling');
    } else {
        player.animations.stop();
    }

    if (cursors.left.isDown) {
        player.body.velocity.x = -PATRICK_VELOCITY_X;
        if (facing_right) {
            facing_right = false; 
            player.scale.x *= -1;
        }
    } else if (cursors.right.isDown) {
        player.body.velocity.x = PATRICK_VELOCITY_X;
        if (!facing_right) {
            facing_right = true; 
            player.scale.x *= -1;
        }
    } else if (walking) {
        // stand still, no horiz movement, but only if walking!
        player.animations.stop();
        player.frame = 14;
    }

    // ===========================
    // ==== Text and counters ====
    // ===========================
    if (game.time.time % 4 === 0) {
        altitude_as_string = numberWithCommas(altitude);
        altitude_text.text = 'Altitude: ' + altitude_as_string;

        var energy_percent = Math.floor(
                (energy / ENERGY_CAP) * 100).toString() + "%";
        energy_text.text = energy_percent;

        if (DEBUG) {
            console.log(
                    '<DEBUG>: Speed: ' + speed.toString() +
                    ', Energy: ' + energy.toString() + 
                    ', Altitude: ' + altitude.toString());
            console.log(energy_percent);
        }
    }

    energy_bar.width = (energy / ENERGY_CAP) * 212;
}

function collect_patty(player, patty) {
    patty.kill();

    aura.reset(player.x, player.y);
    aura.play('revive', 60, false, true);

    energy += 150;
    energy = Math.min(energy, ENERGY_CAP);

    patty_boost_timer = 15;
}


function hit_jellyfish(player, jellyfish) {
    jellyfish.kill();
	if(!in_shield)
    energy = 0;
	in_shield = false;
}


function hit_clam(player, clam) {
	clam.kill();
	if(!in_shield)
	energy = energy - 50;
	in_shield = false;
}	

function hit_shield(player, bubble) {
	shield.exists = true;
	in_shield = true;
	bubble.kill();
}

function hit_shark(player, shark) {
	shark.kill();
	
    if (!game_ended && !in_shield)
        game_over();
	in_shield = false;
}


function add_end_text(text) {
    var game_over_text = game.add.text(
            game.width / 2 - 100, 
            game.height/2,
            text, 
            {font: '40px ' + GAME_TEXT, fill: '#FFF'});
}


function send_highscores() {
    var username = $('#username_field').val();
    var post_to = '/api/highscore_send';
    
    if (!username || 0 === username.length) {
        // TODO: Remind user on screen to enter a username
        return;
    }

    $.post(post_to, { name: username, score: final_altitude },
        function(response) {
            var send_status = response.status;
            if (!send_status) {
                add_end_text('HIGHSCORE SEND ERROR');
            } else {
                window.location.reload();
            }
        }, 'json'
    );
}


function game_over() {
    game_ended = true;
    console.log("Game Over"); 

    speed = 0;
    acceleration = 0;

    game.add.sprite(0, 0, 'black_bg'); 

    final_altitude = altitude.toString();
    add_end_text('Game Over!\nFinal score: ' + final_altitude);

    game.add.text(game.width / 2 - 100, 
                    (game.height/2) + 100,
                    'Enter your username above!',
                    {font: '40px' + GAME_TEXT, fill: '#FFF'});

    var wrapper = $('#username_input');
    wrapper.append('<input id="username_field" type="text"/>');
    wrapper.append('<button id="send_highscores" ' +
                   'onclick="send_highscores()">Submit!</button>');
}

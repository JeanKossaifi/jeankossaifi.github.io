// Highlight the active menu in the page
//
// Author: Jean Kossaifi
// =====================
//

//
// Get the start point of each section
// We assume the page is divided in section, each corresponding to a link with class 'nav-menu'
var navbar = document.querySelector('.navbar');
var navbar_height = navbar.offsetHeight;

var all_sections = document.querySelectorAll('.menu-section');
var active_section = -1 // Currently active section
var section_starts = [] // where in the page the section starts

// Get the corresponding entries in the menu
var menu_entries = document.querySelectorAll('a.navbar-item.menu-link');


// Set the menu section as active
var set_active = function(i) {
	// Turn the active section off
	if (active_section != i) {
		if (active_section >= 0) {
			menu_entries[active_section].classList.remove('menu-active');
		}
		// Turn i active
		menu_entries[i].classList.add('menu-active');
		// Update current active section
		active_section = i;
	}
}

// find the current active section and set it as active
var find_active = function() {
	current_height = window.pageYOffset;
	for (var i=1; i<all_sections.length; i++) {
		if (current_height <= section_starts[i]) {
			set_active(i-1);
			break;
		}
		else if (i == (all_sections.length -1)) {
			set_active(i);
		}
	}
}

// reset all active items
var reset_active = function() {
	for (var i=0; i<menu_entries.length; i++) {
		menu_entries[i].classList.remove('menu-active');
	}
	active_section = -1;
}

// function to compute the height of each section
var get_heights = function () {
	reset_active();
	section_starts = [0] // where in the page the section stats
	for (var i=1; i<all_sections.length; i++) {
		section_starts.push(all_sections[i].offsetTop - navbar_height - 80);
	}
	find_active();
}

// Set active section but not too often to avoid lag
var timer=0;
window.addEventListener('scroll', function(e) {
    //if(timer) { window.clearTimeout(timer); }
	find_active();
    timer = window.setTimeout(function() {
    }, 100);
});

// on resize, recompute heights
get_heights();
find_active();
window.onresize = get_heights;



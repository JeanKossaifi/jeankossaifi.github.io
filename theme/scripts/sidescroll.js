var sidebar = document.getElementById("side-scroll");
var shift = 30;

var set_side_scroll_right = function() {
	var left = Number(10/12*window.innerWidth + shift);
	sidebar.style.left = left + "px";
}

var toggle_side_scroll = function() {
    current_height = window.pageYOffset;
    article_height = document.getElementById("article").offsetHeight;
	inner_height = window.innerHeight;
	max_height = Number(article_height - inner_height);

	if ( (article_height <= inner_height) || (current_height < 200) ) {
        sidebar.classList.add('fade');
        sidebar.style.position = "fixed";
        sidebar.style.top = "20%";
	}
	else if (current_height < max_height) {
        sidebar.classList.remove('fade');
        sidebar.style.position = "fixed";
        sidebar.style.top = "20%";
    }
    else {
        sidebar.classList.remove('fade');
		if (sidebar.style.position == "fixed") {
			sidebar.style.position = "absolute";
			sidebar.style.top = current_height + 0.2*inner_height + "px";
		}
	}
}

// check height but not too often to avoid lag
var timer=0;
set_side_scroll_right();
window.addEventListener('scroll', function(e) {
    //if(timer) { window.clearTimeout(timer); }
    toggle_side_scroll();
    timer = window.setTimeout(function() {
    }, 100);
});

window.onresize = set_side_scroll_right;


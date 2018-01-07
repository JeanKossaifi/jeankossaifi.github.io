var sidebar = document.getElementById("side-scroll");
right = Number(0.07*document.documentElement.clientWidth);
sidebar.style.right = right + "px";

var toggle_side_scroll = function() {
    current_height = window.pageYOffset;
    article_height = document.getElementById("article").offsetHeight;
	client_height = document.documentElement.clientHeight;
	max_height = Number(article_height - client_height);
    if ((current_height > 200) && (current_height < max_height)) {
        sidebar.classList.remove('fade');
        sidebar.style.position = "fixed";
        sidebar.style.top = "40%";
    }
    else if ((current_height >= max_height - 0.6*client_height) && (article_height > client_height)) {
        sidebar.classList.remove('fade');
		if (sidebar.style.position == "fixed") {
			sidebar.style.position = "absolute";
			sidebar.style.top = current_height + 0.4*client_height + "px";
		}
	}
	else {
        sidebar.classList.add('fade');
        sidebar.style.position = "fixed";
        sidebar.style.top = "40%";
    }
}

// check height but not too often to avoid lag
var timer=0;
window.addEventListener('scroll', function(e) {
    //if(timer) { window.clearTimeout(timer); }
    toggle_side_scroll();
    timer = window.setTimeout(function() {
    }, 100);
});



(function smoothscroll(target){
	    var currentScroll = document.documentElement.scrollTop || document.body.scrollTop;
	    if (currentScroll > target) {
			         window.requestAnimationFrame(smoothscroll);
			         window.scrollTo (0, currentScroll - (currentScroll/5));
			    }
})();

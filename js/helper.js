function showAbout(){
  $(".about_modal").show();

  $(".close_modal").on("click",function(){
      $(".about_modal").hide();
  });
}
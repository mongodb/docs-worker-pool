if (obj.status == 718 && obj.response == "redirect") {
  set obj.status = 308;
  declare local var.mapUrl STRING;
  set var.mapUrl = regsuball(req.url.path, "/core/", "");
  set obj.http.Location = table.lookup(redirect_map, var.mapUrl);
  return (deliver);
}

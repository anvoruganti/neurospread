from pipeline.montage import map_channel_list


def selected_channel_renames(names: list[str]) -> dict[str, str]:
    return dict(map_channel_list(names))

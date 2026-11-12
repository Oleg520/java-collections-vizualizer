/** Presentation messages. Keys are stable; values never identify Java operations. */
export const uiRu = {
  "App.skip_to_playback_controls": "К управлению воспроизведением",
  "App.collection": "Коллекция",
  "App.project_source_on_github": "Исходный код проекта на GitHub",
  "App.retry_in_seconds": " Повторный запрос через {0} сек.",
  "App.dismiss_error": "Закрыть ошибку",
  "App.waiting_for_the_java_service_after":
    "Ожидаем Java-сервис. После ошибки можно безопасно обновить состояние.",
  "App.connecting_to_the_java_engine": "Подключаем Java-движок",
  "App.no_connection_to_the_java_engine": "Нет соединения с Java-движком",
  "App.collection_state_will_appear_after_a":
    "Состояние коллекции появится после создания сессии.",
  "collectionViews.add_keys_follow_links_explore_the":
    "Добавляйте ключи. Следите за связями. Исследуйте алгоритм.",
  "collectionViews.key_found_in_the_collection": "ключ найден в коллекции",
  "collectionViews.operation_executed_by_the_java_engine":
    "операция выполнена Java-движком",
  "collectionViews.start_with_put_or_a_scenario": "начните с put или сценария",
  "collectionViews.add_elements_explore_indices_shifts_and":
    "Добавляйте элементы. Следите за индексами, сдвигами и ростом массива.",
  "collectionViews.start_with_add_or_a_scenario": "начните с add или сценария",
  "collectionViews.unknown_snapshot_type": "Неизвестный тип снимка",
  "collectionViews.unknown_trace_collection": "Неизвестная коллекция trace",
  "collectionViews.the_result_appears_when_the_trace":
    "Результат появится после завершения трассировки.",
  "CollectionHelp.about_the_collection_and_switching":
    "О коллекции и переключении",
  "CollectionHelp.teaching_model_openjdk_21": "Учебная модель · OpenJDK 21",
  "CollectionHelp.switching_collections_replaces_the_contents_and":
    "Смена коллекции заменяет её содержимое и очищает историю операций.",
  "ScenarioSidebar.collection_scenarios": "Готовые сценарии коллекции",
  "ScenarioSidebar.ready_made_scenarios": "Готовые сценарии",
  "ScenarioSidebar.expand_sidebar": "Развернуть боковую панель",
  "ScenarioSidebar.collapse_sidebar": "Свернуть боковую панель",
  "ScenarioSidebar.running_a_scenario_replaces_the_collection":
    "Запуск сценария заменяет содержимое коллекции своим начальным состоянием.",
  "ScenarioSidebar.running_replaces_the_collection_contents":
    "{0} Запуск заменяет содержимое коллекции.",
  "ScenarioSidebar.java_is_the_source_of_truth": "Java — источник истины.",
  "ScenarioSidebar.react_is_the_presentation": "React — представление.",
  "StateMetrics.state_metrics": "Показатели состояния",
  "StateMetrics.operation_result": "Результат операции",
  "TraceInspector.algorithm_and_events": "Алгоритм и события",
  "TraceInspector.semantic_stages": "СЕМАНТИЧЕСКИЕ ЭТАПЫ",
  "TraceInspector.execution_events": "События выполнения",
  "TraceInspector.the_trace_is_empty": "Trace ещё пуст",
  "TraceInspector.events_from_actual_operation_execution_will":
    "Здесь появятся события реального выполнения операции.",
  "TraceInspector.algorithm_stages": "Этапы алгоритма",
  "TraceInspector.a_stage_outline_not_executable_code":
    "Схема этапов, не исполняемый код. Активный этап приходит из Java trace.",
  "TraceInspector.openjdk_source": "Исходник OpenJDK",
  "TraceInspector.size_of_the_events_and_technical":
    "Размер областей событий и технических деталей",
  "TraceInspector.upper_pane_technical_details":
    "Верхняя область {0}%, технические детали {1}%",
  "TraceInspector.drag_to_resize_keyboard_home_end":
    "Перетащите для изменения высоты. Клавиатура: ↑/↓, Home/End.",
  "TraceInspector.technical_details": "Технические детали",
  "TraceInspector.technical_details_heading": "ТЕХНИЧЕСКИЕ ДЕТАЛИ",
  "TraceInspector.stage": "Этап:",
  "TraceInspector.formulas_comparisons_and_node_links_will":
    "Формулы, сравнения и ссылки узлов появятся вместе с trace.",
  "arraylist.ArrayCommandPanel.reset_new_structure": "reset · новая структура",
  "arraylist.ArrayCommandPanel.enter_a_whole_number_within_the":
    "Введите целое число в диапазоне Java int.",
  "arraylist.ArrayCommandPanel.arraylist_operations":
    "Панель операций ArrayList",
  "arraylist.ArrayCommandPanel.create_a_new_collection":
    "Создание новой коллекции",
  "arraylist.ArrayCommandPanel.constructor": "Конструктор",
  "arraylist.ArrayCommandPanel.arraylist_constructor": "Конструктор ArrayList",
  "arraylist.ArrayCommandPanel.create": "Создать",
  "arraylist.ArrayCommandPanel.creating_replaces_the_list_and_clears":
    "Создание заменит список и очистит историю.",
  "arraylist.ArrayCommandPanel.operation": "Операция",
  "arraylist.ArrayCommandPanel.index": "Индекс",
  "arraylist.ArrayCommandPanel.element_type": "Тип элемента",
  "arraylist.ArrayCommandPanel.element": "Элемент",
  "arraylist.ArrayCommandPanel.execute": "Выполнить {0}",
  "arraylist.ArrayCommandPanel.execute_button": "Выполнить",
  "arraylist.ArrayCommandPanel.remove_int_index_returns_the_element":
    "remove(int index) возвращает элемент; это удаление по индексу.",
  "arraylist.ArrayCommandPanel.teaching_reset_restores_the_current_session":
    "Учебный reset восстанавливает конструктор текущей сессии. clear сохраняет capacity.",
  "arraylist.ArrayCommandPanel.string_integer_and_null_are_distinct":
    "String, Integer и null различаются. ID обозначает вхождение, а не адрес Java-объекта.",
  "arraylist.ArrayDiagram.new_buffer": "Новый буфер",
  "arraylist.ArrayDiagram.old_elementdata": "Старый elementData",
  "arraylist.ArrayDiagram.array_not_allocated_yet": "Массив ещё не выделен",
  "arraylist.ArrayDiagram.default_empty_the_first_add_allocates":
    "Default-empty: первая add выделит 10 ячеек. Сейчас capacity = 0.",
  "arraylist.ArrayDiagram.explicit_empty_the_first_add_allocates":
    "Explicit-empty: первая add выделит 1 ячейку.",
  "arraylist.ArrayDiagram.free": "свободно",
  "arraylist.ArrayDiagram.slot": "Ячейка {0}: {1}",
  "arraylist.ArrayDiagram.buffer": "{0}; буфер #{1}{2}{3}",
  "arraylist.ArrayDiagram.arraylist_backing_array":
    "Внутренний массив ArrayList",
  "arraylist.ArrayDiagram.inside_arraylist": "Внутри ArrayList",
  "arraylist.ArrayDiagram.a_slot_is_a_fixed_array":
    "Ячейка — фиксированный индекс массива. Внутри — ссылка, включая null; пунктир — свободное место.",
  "arraylist.ArrayDiagram.reference_copying": "Копирование ссылок ·",
  "arraylist.ArrayDiagram.completed": "завершено",
  "arraylist.ArrayDiagram.preparing": "подготовка",
  "arraylist.ArrayDiagram.to": "в",
  "arraylist.ArrayDiagram.new_array_allocated_references_have_not":
    "Новый массив выделен; ссылки ещё не перенесены.",
  "arraylist.ArrayDiagram.one_block_operation_objects_are_not":
    "Одна блочная операция. Объекты не клонируются.",
  "arraylist.ArrayDiagram.shift": "Сдвиг",
  "arraylist.ArrayDiagram.right": "вправо",
  "arraylist.ArrayDiagram.left": "влево",
  "arraylist.ArrayDiagram.source_destination_one_block_operation":
    "Источник → приёмник · одна блочная операция",
  "arraylist.ArrayDiagram.indices_stay_in_place_when_references":
    "Индексы остаются на месте при изменении ссылок.",
  "arraylist.ArrayDiagram.slot_details": "Сведения о ячейке",
  "arraylist.ArrayDiagram.buffer_number": "Буфер #",
  "arraylist.ArrayDiagram.index": "· индекс",
  "arraylist.ArrayDiagram.occurrence": "{0} · {1} · вхождение #{2}",
  "arraylist.ArrayDiagram.empty_no_retained_reference":
    "empty · нет удерживаемой ссылки",
  "arraylist.ArrayDiagram.index_is_within_the_logical_list":
    "Индекс входит в логический размер списка",
  "arraylist.ArrayDiagram.index_is_outside_size": "Индекс за границей size",
  "arraylist.presentation.operation_start_and_result_commit":
    "Начало и фиксация результата",
  "arraylist.presentation.bounds_check_direct_access":
    "Проверка границ; прямой доступ",
  "arraylist.presentation.openjdk_21_default_empty_max_10":
    "OpenJDK 21: default-empty → max(10, minCapacity); explicit-empty → 1 при add",
  "arraylist.presentation.one_block_operation_moves_references_objects":
    "Одна блочная операция перемещает ссылки; объекты не клонируются",
  "arraylist.presentation.write_replace_or_clear_a_reference":
    "Запись, замена или очистка ссылки",
  "arraylist.presentation.linear_search_for_the_first_match":
    "Линейный поиск первого совпадения",
  "arraylist.presentation.new_collection": "Новая коллекция",
  "arraylist.presentation.number_of_entries": "количество записей",
  "arraylist.presentation.array_not_allocated": "массив не выделен",
  "arraylist.presentation.allocated_slots": "выделенных ячеек",
  "arraylist.presentation.free_positions": "свободных позиций",
  "arraylist.presentation.teaching_array_version": "учебная версия массива",
  "hashmap.CommandPanel.hashcode_must_be_a_whole_number":
    "hashCode должен быть целым числом в диапазоне Java int.",
  "hashmap.CommandPanel.enter_a_teaching_key_id": "Введите ID учебного ключа.",
  "hashmap.CommandPanel.enter_a_whole_number_within_the":
    "Введите целое число в диапазоне Java Integer.",
  "hashmap.CommandPanel.operations": "Панель операций",
  "hashmap.CommandPanel.key_type": "Тип ключа",
  "hashmap.CommandPanel.teaching_key_hashcode": "Учебный · hashCode",
  "hashmap.CommandPanel.key_id": "ID ключа",
  "hashmap.CommandPanel.key": "Ключ",
  "hashmap.CommandPanel.value": "Значение",
  "hashmap.CommandPanel.teachingkey_distinct_ids_can_have_the":
    "TeachingKey: разные ID могут иметь один hashCode. Порядок в дереве — по ID.",
  "hashmap.CommandPanel.the_single_null_key_has_hash":
    "Единственный null-ключ имеет hash = 0.",
  "hashmap.CommandPanel.a_real_java_hash_is_computed":
    "{0}: настоящий Java {1}. Хеш вычисляется на сервере.",
  "hashmap.CommandPanel.clear_retains_the_bucket_array":
    "clear сохраняет массив бакетов",
  "hashmap.CommandPanel.start_over": "Начать заново",
  "hashmap.Diagram.hashmap_visualization": "Визуализация HashMap",
  "hashmap.Diagram.inside_hashmap": "Внутри HashMap",
  "hashmap.Diagram.zoom_out": "Уменьшить масштаб",
  "hashmap.Diagram.zoom_100": "Масштаб 100%",
  "hashmap.Diagram.zoom_in": "Увеличить масштаб",
  "hashmap.Diagram.fit_to_width": "Вместить по ширине",
  "hashmap.Diagram.reset_zoom": "Сбросить масштаб",
  "hashmap.Diagram.transfer_state": "Состояние переноса",
  "hashmap.Diagram.new_table": "Новая таблица:",
  "hashmap.Diagram.occupied": "занято",
  "hashmap.Diagram.old_table": "Старая таблица:",
  "hashmap.Diagram.awaiting_transfer": "ожидают переноса",
  "hashmap.Diagram.show": "Показать",
  "hashmap.Diagram.transfer_focus": "Фокус переноса",
  "hashmap.Diagram.follow_current_step": "По текущему шагу",
  "hashmap.Diagram.all_buckets": "Все бакеты",
  "hashmap.Diagram.transfer": "Перенос [",
  "hashmap.Diagram.hide_array": "Скрыть массив",
  "hashmap.Diagram.new_table_array": "Массив новой таблицы",
  "hashmap.Diagram.temporary_objects_outside_table_chains":
    "Временные объекты: {0} · вне табличных цепочек",
  "hashmap.Diagram.old_buckets_retain_entries_until_transfer":
    "Старые бакеты сохраняют записи до переноса",
  "hashmap.Diagram.focus": "· фокус [",
  "hashmap.Diagram.old_table_resize_begins": "Старая table · resize начинается",
  "hashmap.Diagram.hide_empty": "Скрыть пустые",
  "hashmap.Diagram.bucket_array": "Массив бакетов",
  "hashmap.Diagram.bucket": "Бакет {0}: {1}",
  "hashmap.Diagram.buckets": "бакетов ·",
  "hashmap.Diagram.empty_hidden": "· {0} пустых скрыто",
  "hashmap.Diagram.null_empty_bucket": "null — пустой бакет",
  "hashmap.Diagram.the_array_is_allocated_on_the":
    "Массив будет выделен при первом put.",
  "hashmap.Diagram.physical_links": "Физические связи",
  "hashmap.Diagram.go_to_selected_node": "К выбранному узлу",
  "hashmap.Diagram.click_a_bucket_or_node": "Нажмите на бакет или узел",
  "hashmap.Diagram.physical_objects": "физических объектов ·",
  "hashmap.Diagram.outside_chains": "вне цепочек",
  "hashmap.Diagram.link": "Ссылка",
  "hashmap.Diagram.physical_link": "Физическая связь",
  "hashmap.Diagram.select_a_field_of_obj": "Выберите поле obj",
  "hashmap.Diagram.go_to_source": "К источнику",
  "hashmap.Diagram.go_to_target": "К цели",
  "hashmap.Diagram.scrollable_hashmap_diagram": "Прокручиваемая схема HashMap",
  "hashmap.Diagram.all_buckets_are_empty": "Все бакеты пусты",
  "hashmap.Diagram.it_starts_with_the_first_key":
    "Всё начинается с первого ключа",
  "hashmap.Diagram.execute": "Выполните",
  "hashmap.Diagram.or_choose_a_ready_made_scenario":
    "или выберите готовый сценарий.",
  "hashmap.Diagram.the_java_engine_performs_every_transition":
    "Каждый переход здесь выполняет Java-движок.",
  "hashmap.Diagram.list_node": "Узел списка",
  "hashmap.Diagram.r_red": "R · Красный",
  "hashmap.Diagram.b_black": "B · Чёрный",
  "hashmap.Diagram.click_a_node_to_explore_its":
    "Нажмите на узел, чтобы изучить ссылки",
  "hashmap.HashMapGraph.hashmap_nodes_chains_and_red_black":
    "Узлы, цепочки и красно-чёрные деревья HashMap",
  "hashmap.HashMapGraph.temporary": "ВРЕМЕННЫЕ",
  "hashmap.HashMapGraph.old": "СТАРАЯ",
  "hashmap.HashMapGraph.new": "НОВАЯ",
  "hashmap.HashMapGraph.bucket": "БАКЕТ",
  "hashmap.HashMapGraph.snapshot_object_placement":
    "; размещение объектов snapshot",
  "hashmap.HashMapGraph.obj_outside_focus": "{0} → obj {1} · вне фокуса",
  "hashmap.HashMapGraph.node_entry_object":
    "Узел {0}, запись {1}, объект {2}, {3}, {4}{5}",
  "hashmap.HashMapGraph.outside_chain": "вне цепочки",
  "hashmap.NodeDetails.close_node_details": "Закрыть сведения об узле",
  "hashmap.NodeDetails.physical_representation_of_the_entry":
    "Физическое представление записи",
  "hashmap.NodeDetails.in_chain": "в цепочке",
  "hashmap.NodeDetails.obj_go_to_entry": "{0} → obj {1}, перейти к записи {2}",
  "hashmap.graph.temporary_objects": "Временные объекты [{0}]",
  "hashmap.graph.old_table": "Старая таблица [{0}]",
  "hashmap.graph.new_table": "Новая таблица [{0}]",
  "hashmap.graph.bucket": "Бакет [{0}]",
  "hashmap.presentation.operation_start_and_result_commit":
    "Начало операции и фиксация результата",
  "hashmap.presentation.high_bits_influence_low_bits_null":
    "Старшие биты влияют на младшие. null → 0",
  "hashmap.presentation.select_a_bucket_in_a_power":
    "Выбор бакета в таблице степени двойки",
  "hashmap.presentation.check_the_head_chain_or_tree":
    "Проверка головы, цепочки или дерева",
  "hashmap.presentation.change_the_value_links_and_size":
    "Изменение значения, ссылок и size",
  "hashmap.presentation.on_put_the_9th_node_and":
    "При put: 9-й узел и capacity ≥ 64",
  "hashmap.presentation.keep_the_index_or_add_oldcapacity":
    "Оставить индекс или прибавить oldCapacity",
  "hashmap.presentation.null_not_found": "null · не найден",
  "hashmap.presentation.previously": "было {0}",
  "hashmap.presentation.null_new_key": "null · новый ключ",
  "hashmap.presentation.removed": "удалено {0}",
  "hashmap.presentation.collection_cleared": "Коллекция очищена",
  "hashmap.presentation.allocated_buckets": "выделенных бакетов",
  "hashmap.presentation.target_initial_capacity": "целевая начальная ёмкость",
  "hashmap.presentation.resize_when_size_threshold":
    "resize при size > threshold",
  "hashmap.presentation.load_factor": "коэффициент загрузки",
  "PlaybackPanel.synchronization_unconfirmed": "Синхронизация не подтверждена",
  "PlaybackPanel.working_snapshot": "Промежуточный снимок",
  "PlaybackPanel.historical_snapshot": "Исторический снимок",
  "PlaybackPanel.playback_controls": "Управление воспроизведением",
  "PlaybackPanel.go_to_beginning": "В начало",
  "PlaybackPanel.step_back": "Шаг назад",
  "PlaybackPanel.step_forward": "Шаг вперёд",
  "PlaybackPanel.go_to_end": "В конец",
  "PlaybackPanel.step": "ШАГ",
  "PlaybackPanel.current_step_explanation": "Пояснение текущего шага",
  "PlaybackPanel.operations_become_understandable_steps":
    "Операции превращаются в понятные шаги",
  "PlaybackPanel.playback_controls_time_not_java_collection":
    "Воспроизведение управляет временем, а не состоянием Java-коллекции.",
  "PlaybackPanel.expand_player": "Развернуть плеер",
  "PlaybackPanel.collapse_player": "Свернуть плеер",
  "PlaybackPanel.playback_position": "Позиция воспроизведения",
  "PlaybackPanel.speed": "Скорость",
  "PlaybackPanel.playback_speed": "Скорость воспроизведения",
  "PlaybackPanel.operation_history": "История операций",
  "PlaybackPanel.current_server_state": "Текущее состояние сервера",
  "PlaybackPanel.last_12": "последние 12",
} as const;
export const uiEn: Record<keyof typeof uiRu, string> = {
  "App.skip_to_playback_controls": "Skip to playback controls",
  "App.collection": "Collection",
  "App.project_source_on_github": "Project source on GitHub",
  "App.retry_in_seconds": " Retry in {0} seconds.",
  "App.dismiss_error": "Dismiss error",
  "App.waiting_for_the_java_service_after":
    "Waiting for the Java service. After an error, you can safely refresh the state.",
  "App.connecting_to_the_java_engine": "Connecting to the Java engine",
  "App.no_connection_to_the_java_engine": "No connection to the Java engine",
  "App.collection_state_will_appear_after_a":
    "Collection state will appear after a session is created.",
  "collectionViews.add_keys_follow_links_explore_the":
    "Add keys. Follow links. Explore the algorithm.",
  "collectionViews.key_found_in_the_collection": "key found in the collection",
  "collectionViews.operation_executed_by_the_java_engine":
    "operation executed by the Java engine",
  "collectionViews.start_with_put_or_a_scenario":
    "start with put or a scenario",
  "collectionViews.add_elements_explore_indices_shifts_and":
    "Add elements. Explore indices, shifts and array growth.",
  "collectionViews.start_with_add_or_a_scenario":
    "start with add or a scenario",
  "collectionViews.unknown_snapshot_type": "Unknown snapshot type",
  "collectionViews.unknown_trace_collection": "Unknown trace collection",
  "collectionViews.the_result_appears_when_the_trace":
    "The result appears when the trace finishes.",
  "CollectionHelp.about_the_collection_and_switching":
    "About the collection and switching",
  "CollectionHelp.teaching_model_openjdk_21": "Teaching model · OpenJDK 21",
  "CollectionHelp.switching_collections_replaces_the_contents_and":
    "Switching collections replaces the contents and clears operation history.",
  "ScenarioSidebar.collection_scenarios": "Collection scenarios",
  "ScenarioSidebar.ready_made_scenarios": "Ready-made scenarios",
  "ScenarioSidebar.expand_sidebar": "Expand sidebar",
  "ScenarioSidebar.collapse_sidebar": "Collapse sidebar",
  "ScenarioSidebar.running_a_scenario_replaces_the_collection":
    "Running a scenario replaces the collection contents with its initial state.",
  "ScenarioSidebar.running_replaces_the_collection_contents":
    "{0} Running replaces the collection contents.",
  "ScenarioSidebar.java_is_the_source_of_truth": "Java is the source of truth.",
  "ScenarioSidebar.react_is_the_presentation": "React is the presentation.",
  "StateMetrics.state_metrics": "State metrics",
  "StateMetrics.operation_result": "Operation result",
  "TraceInspector.algorithm_and_events": "Algorithm and events",
  "TraceInspector.semantic_stages": "SEMANTIC STAGES",
  "TraceInspector.execution_events": "Execution events",
  "TraceInspector.the_trace_is_empty": "The trace is empty",
  "TraceInspector.events_from_actual_operation_execution_will":
    "Events from actual operation execution will appear here.",
  "TraceInspector.algorithm_stages": "Algorithm stages",
  "TraceInspector.a_stage_outline_not_executable_code":
    "A stage outline, not executable code. The active stage comes from the Java trace.",
  "TraceInspector.openjdk_source": "OpenJDK source",
  "TraceInspector.size_of_the_events_and_technical":
    "Size of the events and technical details panes",
  "TraceInspector.upper_pane_technical_details":
    "Upper pane {0}%, technical details {1}%",
  "TraceInspector.drag_to_resize_keyboard_home_end":
    "Drag to resize. Keyboard: ↑/↓, Home/End.",
  "TraceInspector.technical_details": "Technical details",
  "TraceInspector.technical_details_heading": "TECHNICAL DETAILS",
  "TraceInspector.stage": "Stage:",
  "TraceInspector.formulas_comparisons_and_node_links_will":
    "Formulas, comparisons and node links will appear with the trace.",
  "arraylist.ArrayCommandPanel.reset_new_structure": "reset · new structure",
  "arraylist.ArrayCommandPanel.enter_a_whole_number_within_the":
    "Enter a whole number within the Java int range.",
  "arraylist.ArrayCommandPanel.arraylist_operations": "ArrayList operations",
  "arraylist.ArrayCommandPanel.create_a_new_collection":
    "Create a new collection",
  "arraylist.ArrayCommandPanel.constructor": "Constructor",
  "arraylist.ArrayCommandPanel.arraylist_constructor": "ArrayList constructor",
  "arraylist.ArrayCommandPanel.create": "Create",
  "arraylist.ArrayCommandPanel.creating_replaces_the_list_and_clears":
    "Creating replaces the list and clears history.",
  "arraylist.ArrayCommandPanel.operation": "Operation",
  "arraylist.ArrayCommandPanel.index": "Index",
  "arraylist.ArrayCommandPanel.element_type": "Element type",
  "arraylist.ArrayCommandPanel.element": "Element",
  "arraylist.ArrayCommandPanel.execute": "Execute {0}",
  "arraylist.ArrayCommandPanel.execute_button": "Execute",
  "arraylist.ArrayCommandPanel.remove_int_index_returns_the_element":
    "remove(int index) returns the element; removal is by index.",
  "arraylist.ArrayCommandPanel.teaching_reset_restores_the_current_session":
    "Teaching reset restores the current session constructor. clear retains capacity.",
  "arraylist.ArrayCommandPanel.string_integer_and_null_are_distinct":
    "String, Integer and null are distinct. An ID denotes an occurrence, not a Java object address.",
  "arraylist.ArrayDiagram.new_buffer": "New buffer",
  "arraylist.ArrayDiagram.old_elementdata": "Old elementData",
  "arraylist.ArrayDiagram.array_not_allocated_yet": "Array not allocated yet",
  "arraylist.ArrayDiagram.default_empty_the_first_add_allocates":
    "Default-empty: the first add allocates 10 slots. Current capacity = 0.",
  "arraylist.ArrayDiagram.explicit_empty_the_first_add_allocates":
    "Explicit-empty: the first add allocates 1 slot.",
  "arraylist.ArrayDiagram.free": "free",
  "arraylist.ArrayDiagram.slot": "Slot {0}: {1}",
  "arraylist.ArrayDiagram.buffer": "{0}; buffer #{1}{2}{3}",
  "arraylist.ArrayDiagram.arraylist_backing_array": "ArrayList backing array",
  "arraylist.ArrayDiagram.inside_arraylist": "Inside ArrayList",
  "arraylist.ArrayDiagram.a_slot_is_a_fixed_array":
    "A slot is a fixed array index. It holds a reference, including null; dashed outlines mean free space.",
  "arraylist.ArrayDiagram.reference_copying": "Reference copying ·",
  "arraylist.ArrayDiagram.completed": "completed",
  "arraylist.ArrayDiagram.preparing": "preparing",
  "arraylist.ArrayDiagram.to": "to",
  "arraylist.ArrayDiagram.new_array_allocated_references_have_not":
    "New array allocated; references have not been copied yet.",
  "arraylist.ArrayDiagram.one_block_operation_objects_are_not":
    "One block operation. Objects are not cloned.",
  "arraylist.ArrayDiagram.shift": "Shift",
  "arraylist.ArrayDiagram.right": "right",
  "arraylist.ArrayDiagram.left": "left",
  "arraylist.ArrayDiagram.source_destination_one_block_operation":
    "Source → destination · one block operation",
  "arraylist.ArrayDiagram.indices_stay_in_place_when_references":
    "Indices stay in place when references change.",
  "arraylist.ArrayDiagram.slot_details": "Slot details",
  "arraylist.ArrayDiagram.buffer_number": "Buffer #",
  "arraylist.ArrayDiagram.index": "· index",
  "arraylist.ArrayDiagram.occurrence": "{0} · {1} · occurrence #{2}",
  "arraylist.ArrayDiagram.empty_no_retained_reference":
    "empty · no retained reference",
  "arraylist.ArrayDiagram.index_is_within_the_logical_list":
    "Index is within the logical list size",
  "arraylist.ArrayDiagram.index_is_outside_size": "Index is outside size",
  "arraylist.presentation.operation_start_and_result_commit":
    "Operation start and result commit",
  "arraylist.presentation.bounds_check_direct_access":
    "Bounds check; direct access",
  "arraylist.presentation.openjdk_21_default_empty_max_10":
    "OpenJDK 21: default-empty → max(10, minCapacity); explicit-empty → 1 on add",
  "arraylist.presentation.one_block_operation_moves_references_objects":
    "One block operation moves references; objects are not cloned",
  "arraylist.presentation.write_replace_or_clear_a_reference":
    "Write, replace or clear a reference",
  "arraylist.presentation.linear_search_for_the_first_match":
    "Linear search for the first match",
  "arraylist.presentation.new_collection": "New collection",
  "arraylist.presentation.number_of_entries": "number of entries",
  "arraylist.presentation.array_not_allocated": "array not allocated",
  "arraylist.presentation.allocated_slots": "allocated slots",
  "arraylist.presentation.free_positions": "free positions",
  "arraylist.presentation.teaching_array_version": "teaching array version",
  "hashmap.CommandPanel.hashcode_must_be_a_whole_number":
    "hashCode must be a whole number within the Java int range.",
  "hashmap.CommandPanel.enter_a_teaching_key_id": "Enter a teaching key ID.",
  "hashmap.CommandPanel.enter_a_whole_number_within_the":
    "Enter a whole number within the Java Integer range.",
  "hashmap.CommandPanel.operations": "Operations",
  "hashmap.CommandPanel.key_type": "Key type",
  "hashmap.CommandPanel.teaching_key_hashcode": "Teaching key · hashCode",
  "hashmap.CommandPanel.key_id": "Key ID",
  "hashmap.CommandPanel.key": "Key",
  "hashmap.CommandPanel.value": "Value",
  "hashmap.CommandPanel.teachingkey_distinct_ids_can_have_the":
    "TeachingKey: distinct IDs can have the same hashCode. Tree ordering uses IDs.",
  "hashmap.CommandPanel.the_single_null_key_has_hash":
    "The single null key has hash = 0.",
  "hashmap.CommandPanel.a_real_java_hash_is_computed":
    "{0}: a real Java {1}. Hash is computed on the server.",
  "hashmap.CommandPanel.clear_retains_the_bucket_array":
    "clear retains the bucket array",
  "hashmap.CommandPanel.start_over": "Start over",
  "hashmap.Diagram.hashmap_visualization": "HashMap visualization",
  "hashmap.Diagram.inside_hashmap": "Inside HashMap",
  "hashmap.Diagram.zoom_out": "Zoom out",
  "hashmap.Diagram.zoom_100": "Zoom 100%",
  "hashmap.Diagram.zoom_in": "Zoom in",
  "hashmap.Diagram.fit_to_width": "Fit to width",
  "hashmap.Diagram.reset_zoom": "Reset zoom",
  "hashmap.Diagram.transfer_state": "Transfer state",
  "hashmap.Diagram.new_table": "New table:",
  "hashmap.Diagram.occupied": "occupied",
  "hashmap.Diagram.old_table": "Old table:",
  "hashmap.Diagram.awaiting_transfer": "awaiting transfer",
  "hashmap.Diagram.show": "Show",
  "hashmap.Diagram.transfer_focus": "Transfer focus",
  "hashmap.Diagram.follow_current_step": "Follow current step",
  "hashmap.Diagram.all_buckets": "All buckets",
  "hashmap.Diagram.transfer": "Transfer [",
  "hashmap.Diagram.hide_array": "Hide array",
  "hashmap.Diagram.new_table_array": "New table array",
  "hashmap.Diagram.temporary_objects_outside_table_chains":
    "Temporary objects: {0} · outside table chains",
  "hashmap.Diagram.old_buckets_retain_entries_until_transfer":
    "Old buckets retain entries until transfer",
  "hashmap.Diagram.focus": "· focus [",
  "hashmap.Diagram.old_table_resize_begins": "Old table · resize begins",
  "hashmap.Diagram.hide_empty": "Hide empty",
  "hashmap.Diagram.bucket_array": "Bucket array",
  "hashmap.Diagram.bucket": "Bucket {0}: {1}",
  "hashmap.Diagram.buckets": "buckets ·",
  "hashmap.Diagram.empty_hidden": "· {0} empty hidden",
  "hashmap.Diagram.null_empty_bucket": "null — empty bucket",
  "hashmap.Diagram.the_array_is_allocated_on_the":
    "The array is allocated on the first put.",
  "hashmap.Diagram.physical_links": "Physical links",
  "hashmap.Diagram.go_to_selected_node": "Go to selected node",
  "hashmap.Diagram.click_a_bucket_or_node": "Click a bucket or node",
  "hashmap.Diagram.physical_objects": "physical objects ·",
  "hashmap.Diagram.outside_chains": "outside chains",
  "hashmap.Diagram.link": "Link",
  "hashmap.Diagram.physical_link": "Physical link",
  "hashmap.Diagram.select_a_field_of_obj": "Select a field of obj",
  "hashmap.Diagram.go_to_source": "Go to source",
  "hashmap.Diagram.go_to_target": "Go to target",
  "hashmap.Diagram.scrollable_hashmap_diagram": "Scrollable HashMap diagram",
  "hashmap.Diagram.all_buckets_are_empty": "All buckets are empty",
  "hashmap.Diagram.it_starts_with_the_first_key":
    "It starts with the first key",
  "hashmap.Diagram.execute": "Execute",
  "hashmap.Diagram.or_choose_a_ready_made_scenario":
    "or choose a ready-made scenario.",
  "hashmap.Diagram.the_java_engine_performs_every_transition":
    "The Java engine performs every transition here.",
  "hashmap.Diagram.list_node": "List node",
  "hashmap.Diagram.r_red": "R · Red",
  "hashmap.Diagram.b_black": "B · Black",
  "hashmap.Diagram.click_a_node_to_explore_its":
    "Click a node to explore its links",
  "hashmap.HashMapGraph.hashmap_nodes_chains_and_red_black":
    "HashMap nodes, chains and red-black trees",
  "hashmap.HashMapGraph.temporary": "TEMPORARY",
  "hashmap.HashMapGraph.old": "OLD",
  "hashmap.HashMapGraph.new": "NEW",
  "hashmap.HashMapGraph.bucket": "BUCKET",
  "hashmap.HashMapGraph.snapshot_object_placement":
    "; snapshot object placement",
  "hashmap.HashMapGraph.obj_outside_focus": "{0} → obj {1} · outside focus",
  "hashmap.HashMapGraph.node_entry_object":
    "Node {0}, entry {1}, object {2}, {3}, {4}{5}",
  "hashmap.HashMapGraph.outside_chain": "outside chain",
  "hashmap.NodeDetails.close_node_details": "Close node details",
  "hashmap.NodeDetails.physical_representation_of_the_entry":
    "Physical representation of the entry",
  "hashmap.NodeDetails.in_chain": "in chain",
  "hashmap.NodeDetails.obj_go_to_entry": "{0} → obj {1}, go to entry {2}",
  "hashmap.graph.temporary_objects": "Temporary objects [{0}]",
  "hashmap.graph.old_table": "Old table [{0}]",
  "hashmap.graph.new_table": "New table [{0}]",
  "hashmap.graph.bucket": "Bucket [{0}]",
  "hashmap.presentation.operation_start_and_result_commit":
    "Operation start and result commit",
  "hashmap.presentation.high_bits_influence_low_bits_null":
    "High bits influence low bits. null → 0",
  "hashmap.presentation.select_a_bucket_in_a_power":
    "Select a bucket in a power-of-two table",
  "hashmap.presentation.check_the_head_chain_or_tree":
    "Check the head, chain or tree",
  "hashmap.presentation.change_the_value_links_and_size":
    "Change the value, links and size",
  "hashmap.presentation.on_put_the_9th_node_and":
    "On put: the 9th node and capacity ≥ 64",
  "hashmap.presentation.keep_the_index_or_add_oldcapacity":
    "Keep the index or add oldCapacity",
  "hashmap.presentation.null_not_found": "null · not found",
  "hashmap.presentation.previously": "previously {0}",
  "hashmap.presentation.null_new_key": "null · new key",
  "hashmap.presentation.removed": "removed {0}",
  "hashmap.presentation.collection_cleared": "Collection cleared",
  "hashmap.presentation.allocated_buckets": "allocated buckets",
  "hashmap.presentation.target_initial_capacity": "target initial capacity",
  "hashmap.presentation.resize_when_size_threshold":
    "resize when size > threshold",
  "hashmap.presentation.load_factor": "load factor",
  "PlaybackPanel.synchronization_unconfirmed": "Synchronization unconfirmed",
  "PlaybackPanel.working_snapshot": "Working snapshot",
  "PlaybackPanel.historical_snapshot": "Historical snapshot",
  "PlaybackPanel.playback_controls": "Playback controls",
  "PlaybackPanel.go_to_beginning": "Go to beginning",
  "PlaybackPanel.step_back": "Step back",
  "PlaybackPanel.step_forward": "Step forward",
  "PlaybackPanel.go_to_end": "Go to end",
  "PlaybackPanel.step": "STEP",
  "PlaybackPanel.current_step_explanation": "Current step explanation",
  "PlaybackPanel.operations_become_understandable_steps":
    "Operations become understandable steps",
  "PlaybackPanel.playback_controls_time_not_java_collection":
    "Playback controls time, not Java collection state.",
  "PlaybackPanel.expand_player": "Expand player",
  "PlaybackPanel.collapse_player": "Collapse player",
  "PlaybackPanel.playback_position": "Playback position",
  "PlaybackPanel.speed": "Speed",
  "PlaybackPanel.playback_speed": "Playback speed",
  "PlaybackPanel.operation_history": "Operation history",
  "PlaybackPanel.current_server_state": "Current server state",
  "PlaybackPanel.last_12": "last 12",
};

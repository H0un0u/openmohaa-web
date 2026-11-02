# Emscripten specific settings

if(NOT EMSCRIPTEN)
    return()
endif()

set_property(GLOBAL PROPERTY TARGET_SUPPORTS_SHARED_LIBS TRUE)
set(CMAKE_EXECUTABLE_SUFFIX ".js")
set(CMAKE_SHARED_LIBRARY_SUFFIX ".wasm")
set(BASEGAME "main")

# Disable options that don't make sense for emscripten
set(BUILD_SERVER OFF CACHE INTERNAL "")
set(BUILD_RENDERER_GL1 OFF CACHE BOOL "Build GL1 renderer" FORCE)
set(BUILD_RENDERER_GL2 ON CACHE BOOL "Build GL2 renderer" FORCE)
set(USE_RENDERER_DLOPEN OFF CACHE INTERNAL "")
set(USE_OPENAL_DLOPEN OFF CACHE INTERNAL "")
set(BUILD_GAME_LIBRARIES ON CACHE BOOL "Build browser game modules" FORCE)
set(USE_HTTP OFF CACHE INTERNAL "")
list(APPEND CLIENT_DEFINITIONS
    AL_FORMAT_MONO_IMA4=0x1300
    AL_FORMAT_STEREO_IMA4=0x1301)

# Disable LTO since the libraries Emscripten provides aren't LTO enabled
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION FALSE)

list(APPEND CLIENT_LINK_OPTIONS
    -lidbfs.js
    -fexceptions
    -sINITIAL_MEMORY=256MB
    -sMAXIMUM_MEMORY=4GB
    -sALLOW_MEMORY_GROWTH=1
    -sSTACK_SIZE=5MB
    -sMAIN_MODULE=1
    -sERROR_ON_UNDEFINED_SYMBOLS=0
    -sMIN_WEBGL_VERSION=1
    -sMAX_WEBGL_VERSION=2
    -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency
    -sEXIT_RUNTIME=1
    -sEXPORT_ES6
    -sEXPORT_NAME=${CLIENT_NAME}
)
list(APPEND CLIENT_COMPILE_OPTIONS -fexceptions -fPIC)

option(EMSCRIPTEN_PRELOAD_FILE "Preload game files into .data file" OFF)

if(EMSCRIPTEN_PRELOAD_FILE)
    if(NOT EXISTS "${CMAKE_SOURCE_DIR}/${BASEGAME}")
        message(FATAL_ERROR "No files in '${BASEGAME}' directory for emscripten to preload.")
    endif()
    list(APPEND CLIENT_LINK_OPTIONS --preload-file "${BASEGAME}")
endif()

list(APPEND POST_CONFIGURE_FUNCTIONS deploy_shell_files)

function(deploy_shell_files)
    set(WEB_BUILD_DIR "${CMAKE_BINARY_DIR}/${CMAKE_BUILD_TYPE}")
    file(MAKE_DIRECTORY "${WEB_BUILD_DIR}")
    configure_file(${SOURCE_DIR}/web/client.html
        ${WEB_BUILD_DIR}/${CLIENT_NAME}.html @ONLY)

    if(NOT EMSCRIPTEN_PRELOAD_FILE)
        file(GLOB GAME_PACKS RELATIVE "${CMAKE_SOURCE_DIR}"
            "${CMAKE_SOURCE_DIR}/${BASEGAME}/*.pk3")
        list(SORT GAME_PACKS)
        file(RELATIVE_PATH WEB_SOURCE_ROOT "${WEB_BUILD_DIR}" "${CMAKE_SOURCE_DIR}")
        file(TO_CMAKE_PATH "${WEB_SOURCE_ROOT}" WEB_SOURCE_ROOT_URL)
        list(LENGTH GAME_PACKS GAME_PACK_COUNT)
        set(GAME_CONFIG "{\n  \"${BASEGAME}\": {\n    \"files\": [\n")
        set(PACK_INDEX 0)
        foreach(GAME_PACK IN LISTS GAME_PACKS)
            math(EXPR PACK_INDEX "${PACK_INDEX} + 1")
            get_filename_component(PACK_NAME "${GAME_PACK}" NAME)
            set(PACK_COMMA ",")
            if(PACK_INDEX EQUAL GAME_PACK_COUNT)
                set(PACK_COMMA "")
            endif()
            string(APPEND GAME_CONFIG
                "      {\"src\": \"${WEB_SOURCE_ROOT_URL}/${BASEGAME}/${PACK_NAME}\", \"dst\": \"/${BASEGAME}\"}${PACK_COMMA}\n")
        endforeach()
        if(WEB_AUDIO_PACK_ENABLED)
            string(APPEND GAME_CONFIG
                "      ,{\"src\": \"sound.pk3\", \"dst\": \"/${BASEGAME}\", \"audioPack\": true}\n")
        endif()
        set(MAIN_THEME_MUSIC "${CMAKE_SOURCE_DIR}/${BASEGAME}/sound/music/mus_MainTheme.mp3")
        if(EXISTS "${MAIN_THEME_MUSIC}")
            string(APPEND GAME_CONFIG
                "      ,{\"src\": \"${WEB_SOURCE_ROOT_URL}/${BASEGAME}/sound/music/mus_MainTheme.mp3\", \"dst\": \"/${BASEGAME}/sound/music\"}\n")
        endif()
        string(APPEND GAME_CONFIG
            "      ,{\"src\": \"game.wasm\", \"dst\": \"/\"}\n"
            "      ,{\"src\": \"cgame.wasm\", \"dst\": \"/\"}\n")
        string(APPEND GAME_CONFIG "    ]\n  }\n}\n")
        file(WRITE "${WEB_BUILD_DIR}/${CLIENT_NAME}-config.json" "${GAME_CONFIG}")
    endif()
endfunction()

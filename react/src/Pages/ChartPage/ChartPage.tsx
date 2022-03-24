import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Backdrop,
    Box,
    capitalize,
    Fade,
    FormControl,
    Grid,
    IconButton,
    List,
    ListItem,
    Paper,
    TextField,
} from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util/util';
import getModel from '../../data/model';
import { ForceGraph, Neighborhood } from '../../Visualizations';
import { getEntityId, makeTree, mapTree, stratifyFn } from '../../util';
import { DSINode, isPerson, ModelEntity } from '../../types';
import { CloseIcon } from '../../Icons';
import { LocalDSINode } from '../../Visualizations/Neighborhood/NeighborhoodComponent';

const ChartPage: React.FC = () => {
    const [detailSelection, setDetailSelection] = useState<
        HierarchyNode<ModelEntity>[]
    >([]);
    const [keywordInputString, setKeywordInputString] = useState('');
    const [localViewNode, setLocalViewNode] = useState<DSINode>();
    const [model, setModel] = useState<ModelEntity[]>();
    const [nameSearchInputString, setNameSearchInputString] = useState('');
    const [root, setRoot] = useState<ModelEntity>();
    const [selected, setSelected] = useState<ModelEntity[]>([]);
    const [selectedKeyword, setSelectedKeyword] = useState('');

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
            setRoot(model.find(m => m.type === 'network'));
        };
        _getModel();
    }, []);

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLocalViewNode(undefined);
            }
        };
        window.addEventListener('keydown', listener);

        return () => window.removeEventListener('keydown', listener);
    }, []);

    /* 
        Base tree, which won't be used for visualizations but rather for retrieving all possible descendants of current root,
          including those not in the current graph (e.g., unselected people).
     */
    const tree0 = useMemo(() => {
        if (root && model) {
            const modelEntities = Object.values(model).flat();

            const rootModel = Object.values(model)
                .flat()
                .find(m => m.type === root.type && m.id === root.id)!;

            return makeTree(modelEntities, rootModel);
        }
    }, [model, root]);

    /* tree with selected models attached */
    const tree = useMemo(() => {
        if (tree0) {
            const selectedMap = groupBy(selected, m => `${m.type}-${m.id}`);

            const modelEntities = tree0
                .descendants()
                .map(d => d.data)
                .filter(
                    m => m.type !== 'person' || selectedMap[getEntityId(m)]
                );

            const _tree = stratifyFn(modelEntities);

            /* redundant to map, but for now an easy alternative to putting a `selected` attribute on the model itself */
            return mapTree(_tree, t => ({
                ...t,
                selected: !!selectedMap[getEntityId(t.data)],
            }));
        }
    }, [tree0, selected]);

    const getKeywords = (node: ModelEntity) =>
        isPerson(node) ? node.research_keywords || '' : '';

    const keywords = useMemo(() => {
        if (tree0) {
            const keywords = tree0
                .descendants()
                .flatMap(p => {
                    const keywords = getKeywords(p.data);
                    return keywords
                        .replace(/ +/g, ' ')
                        .split(/[,;]/)
                        .map(w => w.trim().toLowerCase());
                })
                .reduce<{ [key: string]: string[] }>(
                    (acc, curr) => ({
                        ...acc,
                        [curr]: acc[curr] ? acc[curr].concat(curr) : [curr],
                    }),
                    {}
                );

            return (
                Object.entries(keywords)
                    // filter out any singletons, which are often misspellings, whitespace-separated lists, etc.
                    .filter(a => a[1].length > 1)
                    .map(([k]) => k)
                    .filter(Boolean)
                    .sort((a, b) => (a === '' ? 1 : a < b ? -1 : 1))
            );
        }
    }, [tree0]);

    const selectableByKeyword = useMemo(() => {
        return tree0
            ? tree0
                  .descendants()
                  .map(m => ({
                      keywords: getKeywords(m.data),
                      model: m,
                  }))
                  .filter(m => !!m.keywords)
            : [];
    }, [tree0]);

    /* don't pass in nodes b/c autocomplete converts to JSON and you'll get circular errors */
    const names = useMemo(() => {
        if (tree0) {
            return tree0
                ?.descendants()
                .filter(uniqueBy(d => d.data.name))
                .map(v => v.data.name)
                .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
                .filter(Boolean);
        } else {
            return [];
        }
    }, [tree0]);

    const nameMap = useMemo(() => {
        if (model) {
            return groupBy(model, 'name');
        } else {
            return {};
        }
    }, [model]);

    const resetKeywordInputs = useCallback(() => {
        setKeywordInputString('');
        setSelectedKeyword('');
    }, []);

    const resetNameSearch = useCallback(() => {
        setNameSearchInputString('');
        setDetailSelection([]);
    }, []);

    const handleNodeClick = (node: DSINode) => setLocalViewNode(node);

    const handleKeywordSearchSelect = (value?: string) => {
        setSelectedKeyword(value || '');
        if (value) {
            setSelected(
                selectableByKeyword
                    .filter(p =>
                        p.keywords.toLowerCase().includes(value.toLowerCase())
                    )
                    .map(p => p.model.data)
            );
        }
    };

    const handleNameSearchSelect = (value?: string) => {
        if (value && tree0) {
            setDetailSelection(
                tree0!.descendants().filter(m => m.data.name === value)
            );
            setSelected(
                tree0
                    .descendants()
                    .filter(d =>
                        d.data.name.toLowerCase().includes(value.toLowerCase())
                    )
                    .flatMap(v => nameMap[v.data.name])
            );
        } else {
            setDetailSelection([]);
            setSelected([]);
        }
    };

    return (
        <Grid container sx={{ marginTop: 3 }} direction="column" spacing={3}>
            <Grid
                container
                justifyContent="center"
                direction="row"
                item
                xs={12}
                md={9}
                spacing={3}
            >
                <Grid container justifyContent="flex-end" item xs={9}>
                    {tree && (
                        <ForceGraph
                            onNodeClick={handleNodeClick}
                            onBackgroundClick={() => setSelected([])}
                            tree={tree}
                        />
                    )}
                </Grid>
                <Grid
                    item
                    xs={12}
                    md={3}
                    container
                    direction="column"
                    spacing={5}
                >
                    <Grid container direction="column" item spacing={2}>
                        <Grid item>
                            <FormControl fullWidth>
                                {tree0 && tree && (
                                    <ChartPageAutocomplete
                                        label="Search by name or program"
                                        getOptionLabel={m => capitalize(m)}
                                        inputValue={nameSearchInputString}
                                        onInputChange={(value: string) => {
                                            setNameSearchInputString(value);
                                            resetKeywordInputs();
                                            if (!value) {
                                                setSelected([]);
                                            }
                                        }}
                                        onSelect={handleNameSearchSelect}
                                        options={names}
                                        tree={tree}
                                        value={nameSearchInputString}
                                    />
                                )}
                            </FormControl>
                        </Grid>
                        <Grid item>
                            <FormControl fullWidth>
                                {tree && keywords && (
                                    <ChartPageAutocomplete
                                        getOptionLabel={o => capitalize(o)}
                                        inputValue={keywordInputString}
                                        label="Search by keyword"
                                        onInputChange={(value: string) => {
                                            setKeywordInputString(value);
                                            resetNameSearch();
                                            setDetailSelection([]);
                                            if (!value) {
                                                setSelected([]);
                                            }
                                        }}
                                        onSelect={handleKeywordSearchSelect}
                                        options={keywords}
                                        tree={tree}
                                        value={selectedKeyword}
                                    />
                                )}
                            </FormControl>
                        </Grid>
                    </Grid>
                    <Grid item>
                        {!!detailSelection.length && (
                            <DetailCard nodes={detailSelection} />
                        )}
                    </Grid>
                    <Grid item>
                        {!!selected.length && !detailSelection.length && (
                            <List>
                                {selected.map(item => (
                                    <ListItem key={item.name}>
                                        {item.name}
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Grid>
                </Grid>
            </Grid>
            {tree0 && !!localViewNode && (
                <LocalView
                    tree={tree0}
                    nodeId={getEntityId(localViewNode.data)}
                    onClose={() => {
                        setLocalViewNode(undefined);
                        resetKeywordInputs();
                        resetNameSearch();
                    }}
                    resetViewNode={setLocalViewNode}
                    setSelected={setSelected}
                />
            )}
            <Box
                className="tooltip"
                sx={{
                    backgroundColor: theme => theme.palette.grey[900],
                    borderRadius: 1,
                    color: theme => theme.palette.grey[50],
                    fontSize: theme => theme.typography.body2.fontSize,
                    maxWidth: '120px',
                    opacity: 0,
                    padding: 1,
                    position: 'absolute',
                    visibility: 'hidden',
                }}
            ></Box>
        </Grid>
    );
};

interface ChartPageAutocompleteProps {
    getOptionLabel?: (option: string) => string;
    inputValue: string;
    onInputChange: (item: string) => void;
    onSelect?: (item?: string) => void;
    options: string[];
    label: string;
    tree: DSINode;
    value: string;
}

const ChartPageAutocomplete: React.FC<ChartPageAutocompleteProps> = ({
    getOptionLabel,
    inputValue,
    onInputChange,
    onSelect,
    options,
    label,
    tree,
    value,
}) => (
    <Autocomplete
        key={tree?.id}
        clearOnEscape
        freeSolo
        getOptionLabel={getOptionLabel}
        inputValue={inputValue}
        isOptionEqualToValue={(o, v) => o === v}
        onChange={(_, value, reason) => {
            if (onSelect) {
                if (reason === 'selectOption' && value) {
                    onSelect(value);
                }
                if (reason === 'clear') {
                    onSelect(undefined);
                }
            }
        }}
        onInputChange={(_, value) => onInputChange(value)}
        options={options}
        renderInput={params => <TextField {...params} label={label} />}
        value={value}
    />
);

export default ChartPage;

interface LocalViewProps {
    nodeId: string;
    resetViewNode: (node: LocalDSINode) => void;
    onClose: () => void;
    setSelected: (models: ModelEntity[]) => void;
    tree: DSINode;
}

const LocalView: React.FC<LocalViewProps> = ({
    nodeId,
    onClose,
    resetViewNode,
    setSelected,
    tree,
}) => (
    <Fade timeout={500} in={true}>
        <Backdrop sx={{ zIndex: 20, opacity: 0.9 }} open={true}>
            <Paper
                sx={{
                    height: '100%',
                    width: '100%',
                }}
                elevation={0}
            >
                <IconButton
                    disableFocusRipple={true}
                    disableRipple={true}
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        width: '5%',
                    }}
                >
                    <CloseIcon />
                </IconButton>
                <Neighborhood
                    resetViewNode={resetViewNode}
                    selectedNodeId={nodeId}
                    setSelected={setSelected}
                    tree={tree.copy()}
                />
            </Paper>
        </Backdrop>
    </Fade>
);
